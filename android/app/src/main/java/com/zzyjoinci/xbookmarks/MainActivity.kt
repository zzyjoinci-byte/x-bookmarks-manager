package com.zzyjoinci.xbookmarks

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import coil.compose.AsyncImage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

class MainActivity : ComponentActivity() {
    private lateinit var controller: BookmarkController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        controller = BookmarkController(this)
        setContent { BookmarkFoldApp(controller) }
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        controller.close()
        super.onDestroy()
    }

    private fun handleIntent(intent: Intent?) {
        val code = intent?.data?.takeIf { it.scheme == "bookmarkfold" && it.host == "auth" }
            ?.getQueryParameter("code")
        if (!code.isNullOrBlank()) {
            lifecycleScope.launch { controller.exchangeLoginCode(code) }
        }
    }
}

@Serializable data class UserDto(
    val id: String,
    @SerialName("x_username") val xUsername: String,
    @SerialName("display_name") val displayName: String
)

@Serializable data class AuthStartResponse(val url: String)
@Serializable data class AuthExchangeRequest(val code: String)
@Serializable data class AuthExchangeResponse(val token: String, val expiresAt: String, val user: UserDto)
@Serializable data class BookmarksResponse(
    val bookmarks: List<BookmarkDto> = emptyList(),
    val nextCursor: String? = null,
    val counts: Map<String, Int> = emptyMap(),
    val allCategories: List<String> = emptyList()
)
@Serializable data class CategoryPatch(val category: String)
@Serializable data class SyncRequest(val cursor: String? = null)
@Serializable data class SyncResponse(val synced: Int, val nextCursor: String? = null, val done: Boolean)
@Serializable data class ClassifyResponse(val reclassified: Int)
@Serializable data class MeResponse(val user: UserDto)

@Serializable data class BookmarkDto(
    val id: String,
    val text: String,
    @SerialName("author_name") val authorName: String,
    @SerialName("author_username") val authorUsername: String,
    @SerialName("created_at") val createdAt: String? = null,
    val category: String = "uncategorized",
    @SerialName("media_urls") val mediaUrls: List<String> = emptyList()
)

interface BookmarkApi {
    @POST("api/mobile/auth/start") suspend fun startAuth(): AuthStartResponse
    @POST("api/mobile/auth/exchange") suspend fun exchange(@Body body: AuthExchangeRequest): AuthExchangeResponse
    @GET("api/mobile/auth/me") suspend fun me(): MeResponse
    @POST("api/mobile/auth/logout") suspend fun logout()
    @GET("api/mobile/bookmarks") suspend fun bookmarks(
        @Query("category") category: String? = null,
        @Query("cursor") cursor: String? = null,
        @Query("query") query: String? = null
    ): BookmarksResponse
    @GET("api/mobile/bookmarks/{id}") suspend fun bookmark(@Path("id") id: String): Map<String, BookmarkDto>
    @PATCH("api/mobile/bookmarks/{id}") suspend fun updateCategory(@Path("id") id: String, @Body body: CategoryPatch)
    @POST("api/mobile/sync") suspend fun sync(@Body body: SyncRequest): SyncResponse
    @POST("api/mobile/classify") suspend fun classify(): ClassifyResponse
}

class SessionStore(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "bookmarkfold_session",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    var token: String?
        get() = prefs.getString("token", null)
        set(value) = prefs.edit().apply {
            if (value == null) remove("token") else putString("token", value)
        }.apply()
}

data class UiState(
    val token: String? = null,
    val user: UserDto? = null,
    val bookmarks: List<BookmarkDto> = emptyList(),
    val counts: Map<String, Int> = emptyMap(),
    val categories: List<String> = emptyList(),
    val selectedCategory: String? = null,
    val selectedBookmark: BookmarkDto? = null,
    val screen: Screen = Screen.Feed,
    val loading: Boolean = false,
    val message: String? = null
)

enum class Screen { Feed, Categories, Settings }

class BookmarkController(context: Context) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val store = SessionStore(appContext)
    private val json = Json { ignoreUnknownKeys = true }
    private val api = buildApi()

    var state by mutableStateOf(UiState(token = store.token))
        private set

    init {
        if (state.token != null) {
            loadMe()
            loadBookmarks(reset = true)
        }
    }

    fun close() {
        scope.cancel()
    }

    fun startLogin() {
        scope.launch {
            setLoading(true, null)
            runCatching { withContext(Dispatchers.IO) { api.startAuth() } }
                .onSuccess { appContext.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                .onFailure { state = state.copy(loading = false, message = it.message) }
        }
    }

    suspend fun exchangeLoginCode(code: String) {
        setLoading(true, "Finishing sign in...")
        runCatching { withContext(Dispatchers.IO) { api.exchange(AuthExchangeRequest(code)) } }
            .onSuccess {
                store.token = it.token
                state = state.copy(token = it.token, user = it.user, message = "Signed in")
                loadBookmarks(reset = true)
            }
            .onFailure { state = state.copy(loading = false, message = it.message) }
    }

    fun loadBookmarks(reset: Boolean = false) {
        scope.launch {
            setLoading(true, null)
            val category = state.selectedCategory
            runCatching { withContext(Dispatchers.IO) { api.bookmarks(category = category) } }
                .onSuccess {
                    state = state.copy(
                        bookmarks = it.bookmarks,
                        counts = it.counts,
                        categories = it.allCategories,
                        selectedBookmark = if (reset) null else state.selectedBookmark,
                        loading = false
                    )
                }
                .onFailure { handleFailure(it) }
        }
    }

    fun selectCategory(category: String?) {
        state = state.copy(selectedCategory = category, screen = Screen.Feed)
        loadBookmarks(reset = true)
    }

    fun selectBookmark(bookmark: BookmarkDto?) {
        state = state.copy(selectedBookmark = bookmark)
    }

    fun setScreen(screen: Screen) {
        state = state.copy(screen = screen, selectedBookmark = null)
    }

    fun updateCategory(bookmark: BookmarkDto, category: String) {
        scope.launch {
            setLoading(true, null)
            runCatching { withContext(Dispatchers.IO) { api.updateCategory(bookmark.id, CategoryPatch(category)) } }
                .onSuccess {
                    state = state.copy(
                        bookmarks = state.bookmarks.map { if (it.id == bookmark.id) it.copy(category = category) else it },
                        selectedBookmark = bookmark.copy(category = category),
                        loading = false
                    )
                }
                .onFailure { handleFailure(it) }
        }
    }

    fun syncAll() {
        scope.launch {
            var cursor: String? = null
            var total = 0
            var done: Boolean
            setLoading(true, "Syncing...")
            do {
                val result = runCatching { withContext(Dispatchers.IO) { api.sync(SyncRequest(cursor)) } }
                val page = result.getOrElse {
                    handleFailure(it)
                    return@launch
                }
                total += page.synced
                cursor = page.nextCursor
                done = page.done
                state = state.copy(message = "Synced $total bookmarks...")
            } while (!done)
            state = state.copy(message = "Sync complete: $total bookmarks", loading = false)
            loadBookmarks(reset = true)
        }
    }

    fun reclassify() {
        scope.launch {
            setLoading(true, "Reclassifying...")
            runCatching { withContext(Dispatchers.IO) { api.classify() } }
                .onSuccess {
                    state = state.copy(message = "Reclassified ${it.reclassified} bookmarks", loading = false)
                    loadBookmarks(reset = true)
                }
                .onFailure { handleFailure(it) }
        }
    }

    fun logout() {
        scope.launch {
            runCatching { withContext(Dispatchers.IO) { api.logout() } }
            store.token = null
            state = UiState()
        }
    }

    private fun loadMe() {
        scope.launch {
            runCatching { withContext(Dispatchers.IO) { api.me() } }
                .onSuccess { state = state.copy(user = it.user) }
                .onFailure { if (it.message?.contains("401") == true) logout() }
        }
    }

    private fun buildApi(): BookmarkApi {
        val client = OkHttpClient.Builder()
            .addInterceptor(Interceptor { chain ->
                val builder = chain.request().newBuilder()
                store.token?.let { builder.addHeader("Authorization", "Bearer $it") }
                chain.proceed(builder.build())
            })
            .build()
        val baseUrl = if (BuildConfig.API_BASE_URL.endsWith("/")) BuildConfig.API_BASE_URL else "${BuildConfig.API_BASE_URL}/"
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(BookmarkApi::class.java)
    }

    private fun setLoading(loading: Boolean, message: String?) {
        state = state.copy(loading = loading, message = message)
    }

    private fun handleFailure(error: Throwable) {
        val unauthorized = error.message?.contains("401") == true || error.message?.contains("Unauthorized") == true
        if (unauthorized) {
            store.token = null
            state = UiState(message = "Session expired")
        } else {
            state = state.copy(loading = false, message = error.message ?: "Request failed")
        }
    }
}

@Composable
fun BookmarkFoldApp(controller: BookmarkController) {
    MaterialTheme {
        Surface(Modifier.fillMaxSize()) {
            val state = controller.state
            if (state.token == null) LoginScreen(controller, state) else MainScreen(controller, state)
        }
    }
}

@Composable
fun LoginScreen(controller: BookmarkController, state: UiState) {
    val context = LocalContext.current
    Column(
        modifier = Modifier.fillMaxSize().padding(28.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("BookmarkFold", style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text("Organize saved X posts into a readable mobile library.")
        Spacer(Modifier.height(28.dp))
        Button(onClick = { controller.startLogin() }, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
            Text(if (state.loading) "Starting..." else "Sign in with X")
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "Privacy Policy",
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.clickable {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.PRIVACY_POLICY_URL)))
            }
        )
        state.message?.let {
            Spacer(Modifier.height(16.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
fun MainScreen(controller: BookmarkController, state: UiState) {
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(selected = state.screen == Screen.Feed, onClick = { controller.setScreen(Screen.Feed) }, label = { Text("Feed") }, icon = {})
                NavigationBarItem(selected = state.screen == Screen.Categories, onClick = { controller.setScreen(Screen.Categories) }, label = { Text("Categories") }, icon = {})
                NavigationBarItem(selected = state.screen == Screen.Settings, onClick = { controller.setScreen(Screen.Settings) }, label = { Text("Me") }, icon = {})
            }
        }
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state.selectedBookmark != null -> DetailScreen(controller, state)
                state.screen == Screen.Categories -> CategoriesScreen(controller, state)
                state.screen == Screen.Settings -> SettingsScreen(controller, state)
                else -> FeedScreen(controller, state)
            }
            if (state.loading) {
                CircularProgressIndicator(Modifier.align(Alignment.Center))
            }
        }
    }
}

@Composable
fun FeedScreen(controller: BookmarkController, state: UiState) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("BookmarkFold", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(state.selectedCategory ?: "All bookmarks", style = MaterialTheme.typography.bodyMedium)
            }
            Button(onClick = { controller.syncAll() }) { Text("Sync") }
        }
        CategoryChips(state, controller)
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(state.bookmarks, key = { it.id }) { bookmark ->
                BookmarkCard(bookmark) { controller.selectBookmark(bookmark) }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CategoryChips(state: UiState, controller: BookmarkController) {
    FlowRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        AssistChip(onClick = { controller.selectCategory(null) }, label = { Text("All ${state.counts.values.sum()}") })
        state.categories.forEach { category ->
            AssistChip(onClick = { controller.selectCategory(category) }, label = { Text("$category ${state.counts[category] ?: 0}") })
        }
    }
}

@Composable
fun BookmarkCard(bookmark: BookmarkDto, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("@${bookmark.authorUsername} · ${bookmark.createdAt.orEmpty().take(10)}", style = MaterialTheme.typography.labelMedium)
            Spacer(Modifier.height(8.dp))
            Text(bookmark.text, maxLines = 4, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(10.dp))
            Text(bookmark.category, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            bookmark.mediaUrls.firstOrNull()?.let {
                Spacer(Modifier.height(12.dp))
                AsyncImage(model = it, contentDescription = null, modifier = Modifier.fillMaxWidth().height(180.dp))
            }
        }
    }
}

@Composable
fun DetailScreen(controller: BookmarkController, state: UiState) {
    val bookmark = state.selectedBookmark ?: return
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
        Button(onClick = { controller.selectBookmark(null) }) { Text("Back") }
        Spacer(Modifier.height(16.dp))
        Text("@${bookmark.authorUsername}", style = MaterialTheme.typography.titleMedium)
        Text(bookmark.createdAt.orEmpty().take(10), style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(12.dp))
        Text(bookmark.text, style = MaterialTheme.typography.bodyLarge)
        Spacer(Modifier.height(16.dp))
        Text("Category", fontWeight = FontWeight.Bold)
        CategoryEditor(controller, state, bookmark)
        bookmark.mediaUrls.forEach {
            Spacer(Modifier.height(12.dp))
            AsyncImage(model = it, contentDescription = null, modifier = Modifier.fillMaxWidth().height(260.dp))
        }
        Spacer(Modifier.height(16.dp))
        Button(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://x.com/${bookmark.authorUsername}/status/${bookmark.id}"))) }) {
            Text("Open on X")
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CategoryEditor(controller: BookmarkController, state: UiState, bookmark: BookmarkDto) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        state.categories.forEach { category ->
            AssistChip(onClick = { controller.updateCategory(bookmark, category) }, label = { Text(category) })
        }
    }
}

@Composable
fun CategoriesScreen(controller: BookmarkController, state: UiState) {
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        Text("Categories", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(16.dp))
        CategoryChips(state, controller)
        Spacer(Modifier.height(16.dp))
        Text("Custom category rule editing is planned for v2.")
    }
}

@Composable
fun SettingsScreen(controller: BookmarkController, state: UiState) {
    val context = LocalContext.current
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Account", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(state.user?.let { "@${it.xUsername}" } ?: "Signed in")
        Divider()
        Button(onClick = { controller.syncAll() }, modifier = Modifier.fillMaxWidth()) { Text("Sync bookmarks") }
        Button(onClick = { controller.reclassify() }, modifier = Modifier.fillMaxWidth()) { Text("Reclassify all") }
        Button(onClick = { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.PRIVACY_POLICY_URL))) }, modifier = Modifier.fillMaxWidth()) {
            Text("Privacy Policy")
        }
        Button(onClick = { controller.logout() }, modifier = Modifier.fillMaxWidth()) { Text("Logout") }
        state.message?.let { Text(it) }
    }
}
