import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  API_BASE_URL,
  classifyBookmarks,
  exchangeAuthCode,
  getBookmark,
  getMe,
  listBookmarks,
  logout as logoutRequest,
  startAuth,
  syncBookmarks,
  updateBookmarkCategory,
} from "./src/api";
import { cleanText, compactNumber, shortDate } from "./src/format";
import { getStoredToken, setStoredToken } from "./src/session";
import { colors, radii } from "./src/theme";
import type { BookmarkDto, Screen, UserDto } from "./src/types";

WebBrowser.maybeCompleteAuthSession();

const PRIVACY_URL = "https://x-bookmarks-manager.vercel.app/privacy";
const REDIRECT_URL = "bookmarkfold://auth";
const PAGE_SIZE_HINT = 30;
const fontSans = "SpaceGrotesk_400Regular";
const fontMedium = "SpaceGrotesk_500Medium";
const fontBold = "SpaceGrotesk_700Bold";
const fontSerif = "InstrumentSerif_400Regular";

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    InstrumentSerif_400Regular,
  });
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserDto | null>(null);
  const [screen, setScreen] = useState<Screen>("feed");
  const [bookmarks, setBookmarks] = useState<BookmarkDto[]>([]);
  const [selected, setSelected] = useState<BookmarkDto | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const authInFlight = useRef(false);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleAuthRedirect(url);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void bootstrap();
  }, []);

  const allCount = useMemo(() => Object.values(counts).reduce((sum, item) => sum + item, 0), [counts]);
  const visibleCategory = category || "All";

  async function bootstrap() {
    const storedToken = await getStoredToken();
    if (!storedToken) {
      setReady(true);
      return;
    }
    setToken(storedToken);
    try {
      const me = await getMe(storedToken);
      setUser(me.user);
      await refreshBookmarks({ tokenOverride: storedToken, reset: true });
    } catch {
      await setStoredToken(null);
      setToken(null);
    } finally {
      setReady(true);
    }
  }

  async function handleAuthRedirect(url: string) {
    void WebBrowser.dismissBrowser().catch(() => undefined);
    const parsed = Linking.parse(url);
    const rawCode = parsed.queryParams?.code;
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    if (!code || typeof code !== "string" || authInFlight.current) return;

    authInFlight.current = true;
    setBusy(true);
    setMessage("Finishing sign in...");
    try {
      const response = await exchangeAuthCode(code);
      await setStoredToken(response.token);
      setToken(response.token);
      setUser(response.user);
      setScreen("feed");
      setSelected(null);
      setMessage("Signed in. Pulling your library...");
      await refreshBookmarks({ tokenOverride: response.token, reset: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      authInFlight.current = false;
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await startAuth();
      const result = await WebBrowser.openAuthSessionAsync(response.url, REDIRECT_URL);
      if (result.type === "success") {
        await handleAuthRedirect(result.url);
      } else {
        setBusy(false);
      }
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Unable to start X sign in");
    }
  }

  async function refreshBookmarks(input: {
    tokenOverride?: string;
    categoryOverride?: string | null;
    queryOverride?: string;
    cursor?: string | null;
    reset?: boolean;
  } = {}) {
    const activeToken = input.tokenOverride || token;
    if (!activeToken) return;

    const isNextPage = Boolean(input.cursor);
    if (isNextPage) setLoadingMore(true);
    else setBusy(true);

    try {
      const response = await listBookmarks({
        token: activeToken,
        category: input.categoryOverride ?? category,
        query: input.queryOverride ?? query,
        cursor: input.cursor || null,
      });
      setBookmarks((current) => (isNextPage ? [...current, ...response.bookmarks] : response.bookmarks));
      setCounts(response.counts);
      setCategories(response.allCategories);
      setNextCursor(response.nextCursor);
      setMessage(response.bookmarks.length === 0 && !isNextPage ? "No bookmarks in this view yet." : null);
    } catch (error) {
      await handleFailure(error);
    } finally {
      setBusy(false);
      setLoadingMore(false);
    }
  }

  async function loadBookmarkDetail(bookmark: BookmarkDto) {
    if (!token) return;
    setSelected(bookmark);
    try {
      const response = await getBookmark(token, bookmark.id);
      setSelected(response.bookmark);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load detail");
    }
  }

  async function chooseCategory(nextCategory: string | null) {
    setCategory(nextCategory);
    setSelected(null);
    setScreen("feed");
    await refreshBookmarks({ categoryOverride: nextCategory, reset: true });
  }

  async function search(value: string) {
    setQuery(value);
    await refreshBookmarks({ queryOverride: value, reset: true });
  }

  async function saveCategory(nextCategory: string) {
    if (!token || !selected) return;
    const previous = selected;
    const updated = { ...selected, category: nextCategory };
    setSelected(updated);
    setBookmarks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    try {
      await updateBookmarkCategory(token, updated.id, nextCategory);
      await refreshBookmarks({ reset: true });
    } catch (error) {
      setSelected(previous);
      setMessage(error instanceof Error ? error.message : "Failed to update category");
    }
  }

  async function syncAll() {
    if (!token) return;
    setBusy(true);
    setMessage("Syncing from X...");
    let cursor: string | null = null;
    let total = 0;
    try {
      for (let page = 0; page < 80; page += 1) {
        const response = await syncBookmarks(token, cursor);
        total += response.synced;
        cursor = response.nextCursor;
        setMessage(`Synced ${total} bookmarks...`);
        if (response.done) break;
      }
      setMessage(`Sync complete: ${total} bookmarks`);
      await refreshBookmarks({ reset: true });
    } catch (error) {
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  }

  async function reclassifyAll() {
    if (!token) return;
    setBusy(true);
    setMessage("Reclassifying your library...");
    try {
      const response = await classifyBookmarks(token);
      setMessage(`Reclassified ${response.reclassified} bookmarks`);
      await refreshBookmarks({ reset: true });
    } catch (error) {
      await handleFailure(error);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const oldToken = token;
    setBusy(true);
    await logoutRequest(oldToken).catch(() => undefined);
    await setStoredToken(null);
    setToken(null);
    setUser(null);
    setBookmarks([]);
    setCounts({});
    setCategories([]);
    setSelected(null);
    setScreen("feed");
    setCategory(null);
    setQuery("");
    setMessage(null);
    setBusy(false);
  }

  async function handleFailure(error: unknown) {
    const text = error instanceof Error ? error.message : "Request failed";
    if (text.includes("Unauthorized") || text.includes("401")) {
      await setStoredToken(null);
      setToken(null);
      setUser(null);
      setMessage("Session expired. Please sign in again.");
      return;
    }
    setMessage(text);
  }

  if (!fontsLoaded || !ready) {
    return (
      <SafeAreaProvider>
        <View style={styles.boot}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <LinearGradient colors={[colors.paper, "#F9E7DF", "#EEF5D5"]} style={styles.appShell}>
        <SafeAreaView style={styles.safeArea}>
          {!token ? (
            <LoginScreen busy={busy} message={message} onLogin={login} />
          ) : selected ? (
            <DetailScreen
              bookmark={selected}
              categories={categories}
              busy={busy}
              onBack={() => setSelected(null)}
              onOpenX={() => Linking.openURL(`https://x.com/${selected.author_username}/status/${selected.id}`)}
              onSaveCategory={saveCategory}
            />
          ) : (
            <View style={styles.main}>
              {screen === "feed" ? (
                <FeedScreen
                  bookmarks={bookmarks}
                  counts={counts}
                  categories={categories}
                  selectedCategory={category}
                  query={query}
                  allCount={allCount}
                  visibleCategory={visibleCategory}
                  nextCursor={nextCursor}
                  busy={busy}
                  loadingMore={loadingMore}
                  message={message}
                  onSync={syncAll}
                  onSelectCategory={chooseCategory}
                  onOpenBookmark={loadBookmarkDetail}
                  onSearch={search}
                  onLoadMore={() => refreshBookmarks({ cursor: nextCursor })}
                />
              ) : null}
              {screen === "categories" ? (
                <CategoriesScreen
                  allCount={allCount}
                  counts={counts}
                  categories={categories}
                  selectedCategory={category}
                  onSelectCategory={chooseCategory}
                  onReclassify={reclassifyAll}
                />
              ) : null}
              {screen === "me" ? (
                <MeScreen
                  user={user}
                  message={message}
                  busy={busy}
                  apiBaseUrl={API_BASE_URL}
                  onSync={syncAll}
                  onReclassify={reclassifyAll}
                  onPrivacy={() => Linking.openURL(PRIVACY_URL)}
                  onLogout={() => {
                    Alert.alert("Log out?", "This only removes the local app session.", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Log out", style: "destructive", onPress: logout },
                    ]);
                  }}
                />
              ) : null}
              <BottomNav screen={screen} onChange={setScreen} />
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

function LoginScreen({
  busy,
  message,
  onLogin,
}: {
  busy: boolean;
  message: string | null;
  onLogin: () => void;
}) {
  return (
    <View style={styles.login}>
      <View style={styles.loginMark}>
        <Text style={styles.loginMarkText}>BF</Text>
      </View>
      <Text style={styles.loginKicker}>X bookmarks, folded into a library</Text>
      <Text style={styles.loginTitle}>BookmarkFold</Text>
      <Text style={styles.loginCopy}>
        Sync your saved X posts, classify them automatically, and read them like a curated field notebook.
      </Text>
      <Pressable disabled={busy} onPress={onLogin} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        {busy ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.primaryButtonText}>Sign in with X</Text>}
      </Pressable>
      <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.linkButton}>
        <Text style={styles.linkButtonText}>Privacy Policy</Text>
      </Pressable>
      {message ? <Text style={styles.inlineMessage}>{message}</Text> : null}
    </View>
  );
}

function FeedScreen(props: {
  bookmarks: BookmarkDto[];
  counts: Record<string, number>;
  categories: string[];
  selectedCategory: string | null;
  query: string;
  allCount: number;
  visibleCategory: string;
  nextCursor: string | null;
  busy: boolean;
  loadingMore: boolean;
  message: string | null;
  onSync: () => void;
  onSelectCategory: (category: string | null) => void;
  onOpenBookmark: (bookmark: BookmarkDto) => void;
  onSearch: (value: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <FlatList
      data={props.bookmarks}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.feedList}
      ListHeaderComponent={
        <View>
          <View style={styles.feedHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.smallCaps}>BookmarkFold</Text>
              <Text style={styles.feedTitle}>{props.visibleCategory}</Text>
              <Text style={styles.feedMeta}>
                {compactNumber(props.allCount)} saved posts · cloud library
              </Text>
            </View>
            <Pressable onPress={props.onSync} disabled={props.busy} style={styles.syncButton}>
              <Text style={styles.syncButtonText}>{props.busy ? "..." : "Sync"}</Text>
            </Pressable>
          </View>
          <TextInput
            value={props.query}
            onChangeText={props.onSearch}
            placeholder="Search author or text"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
          <CategoryRail
            counts={props.counts}
            categories={props.categories}
            selectedCategory={props.selectedCategory}
            allCount={props.allCount}
            onSelect={props.onSelectCategory}
          />
          {props.message ? <Text style={styles.notice}>{props.message}</Text> : null}
        </View>
      }
      renderItem={({ item, index }) => (
        <BookmarkCard bookmark={item} index={index} onPress={() => props.onOpenBookmark(item)} />
      )}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (props.nextCursor && !props.loadingMore && !props.busy && props.bookmarks.length >= PAGE_SIZE_HINT) {
          props.onLoadMore();
        }
      }}
      ListFooterComponent={
        props.loadingMore ? (
          <View style={styles.footerLoading}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : (
          <View style={styles.footerSpacer} />
        )
      }
    />
  );
}

function CategoryRail({
  counts,
  categories,
  selectedCategory,
  allCount,
  onSelect,
}: {
  counts: Record<string, number>;
  categories: string[];
  selectedCategory: string | null;
  allCount: number;
  onSelect: (category: string | null) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      <CategoryChip label="All" count={allCount} selected={!selectedCategory} onPress={() => onSelect(null)} />
      {categories.map((item) => (
        <CategoryChip
          key={item}
          label={item}
          count={counts[item] || 0}
          selected={selectedCategory === item}
          onPress={() => onSelect(item)}
        />
      ))}
    </ScrollView>
  );
}

function CategoryChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count?: number;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label} {typeof count === "number" ? compactNumber(count) : ""}
      </Text>
    </Pressable>
  );
}

function BookmarkCard({
  bookmark,
  index,
  onPress,
}: {
  bookmark: BookmarkDto;
  index: number;
  onPress: () => void;
}) {
  const hasImage = bookmark.media_urls.length > 0;
  const accent = index % 3 === 0 ? colors.acid : index % 3 === 1 ? "#FFD7C8" : "#DDE9FF";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />
      <View style={styles.card}>
        <View style={styles.cardMetaRow}>
          <Text style={styles.author}>@{bookmark.author_username}</Text>
          <Text style={styles.date}>{shortDate(bookmark.created_at)}</Text>
        </View>
        <Text style={styles.cardText} numberOfLines={5}>
          {cleanText(bookmark.text)}
        </Text>
        <View style={styles.cardBottom}>
          <Text style={styles.categoryLabel}>{bookmark.category}</Text>
          <Text style={styles.foldHint}>Open</Text>
        </View>
        {hasImage ? (
          <Image
            source={{ uri: bookmark.media_urls[0] }}
            style={styles.cardImage}
            contentFit="cover"
            transition={180}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function DetailScreen({
  bookmark,
  categories,
  busy,
  onBack,
  onOpenX,
  onSaveCategory,
}: {
  bookmark: BookmarkDto;
  categories: string[];
  busy: boolean;
  onBack: () => void;
  onOpenX: () => void;
  onSaveCategory: (category: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.detail}>
      <View style={styles.detailTop}>
        <Pressable onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Pressable onPress={onOpenX} style={styles.secondaryButtonDark}>
          <Text style={styles.secondaryButtonDarkText}>Open X</Text>
        </Pressable>
      </View>
      <Text style={styles.detailAuthor}>@{bookmark.author_username}</Text>
      <Text style={styles.detailDate}>{shortDate(bookmark.created_at)}</Text>
      <Text style={styles.detailText}>{bookmark.text}</Text>
      <Text style={styles.sectionTitle}>Category</Text>
      <View style={styles.categoryGrid}>
        {categories.map((item) => (
          <CategoryChip
            key={item}
            label={item}
            selected={bookmark.category === item}
            onPress={() => onSaveCategory(item)}
          />
        ))}
      </View>
      {busy ? <ActivityIndicator color={colors.ink} style={styles.detailSpinner} /> : null}
      {bookmark.media_urls.map((url) => (
        <Image key={url} source={{ uri: url }} style={styles.detailImage} contentFit="cover" transition={180} />
      ))}
    </ScrollView>
  );
}

function CategoriesScreen({
  allCount,
  counts,
  categories,
  selectedCategory,
  onSelectCategory,
  onReclassify,
}: {
  allCount: number;
  counts: Record<string, number>;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onReclassify: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.smallCaps}>Library map</Text>
      <Text style={styles.pageTitle}>Categories</Text>
      <Pressable onPress={() => onSelectCategory(null)} style={[styles.categoryTile, !selectedCategory && styles.tileSelected]}>
        <Text style={styles.tileName}>All saved posts</Text>
        <Text style={styles.tileCount}>{compactNumber(allCount)}</Text>
      </Pressable>
      {categories.map((item) => (
        <Pressable
          key={item}
          onPress={() => onSelectCategory(item)}
          style={[styles.categoryTile, selectedCategory === item && styles.tileSelected]}
        >
          <Text style={styles.tileName}>{item}</Text>
          <Text style={styles.tileCount}>{compactNumber(counts[item] || 0)}</Text>
        </Pressable>
      ))}
      <Pressable onPress={onReclassify} style={styles.wideAction}>
        <Text style={styles.wideActionText}>Reclassify all bookmarks</Text>
      </Pressable>
    </ScrollView>
  );
}

function MeScreen({
  user,
  message,
  busy,
  apiBaseUrl,
  onSync,
  onReclassify,
  onPrivacy,
  onLogout,
}: {
  user: UserDto | null;
  message: string | null;
  busy: boolean;
  apiBaseUrl: string;
  onSync: () => void;
  onReclassify: () => void;
  onPrivacy: () => void;
  onLogout: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.smallCaps}>Account</Text>
      <Text style={styles.pageTitle}>{user?.display_name || "BookmarkFold"}</Text>
      <Text style={styles.accountName}>{user ? `@${user.x_username}` : "Signed in"}</Text>
      <View style={styles.settingsCard}>
        <SettingsRow label="Sync bookmarks" detail="Pull the next pages from X" onPress={onSync} disabled={busy} />
        <SettingsRow label="Reclassify all" detail="Run current AI/rule categories again" onPress={onReclassify} disabled={busy} />
        <SettingsRow label="Privacy Policy" detail="Open the hosted policy page" onPress={onPrivacy} />
        <SettingsRow label="Log out" detail="Remove local session" onPress={onLogout} destructive />
      </View>
      <Text style={styles.endpoint}>API: {apiBaseUrl}</Text>
      {message ? <Text style={styles.notice}>{message}</Text> : null}
    </ScrollView>
  );
}

function SettingsRow({
  label,
  detail,
  destructive,
  disabled,
  onPress,
}: {
  label: string;
  detail: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.settingsRow}>
      <View>
        <Text style={[styles.settingsLabel, destructive && styles.destructive]}>{label}</Text>
        <Text style={styles.settingsDetail}>{detail}</Text>
      </View>
      <Text style={styles.settingsArrow}>→</Text>
    </Pressable>
  );
}

function BottomNav({ screen, onChange }: { screen: Screen; onChange: (screen: Screen) => void }) {
  return (
    <View style={styles.nav}>
      <NavItem label="Feed" active={screen === "feed"} onPress={() => onChange("feed")} />
      <NavItem label="Categories" active={screen === "categories"} onPress={() => onChange("categories")} />
      <NavItem label="Me" active={screen === "me"} onPress={() => onChange("me")} />
    </View>
  );
}

function NavItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.navItem}>
      <View style={[styles.navIndicator, active && styles.navIndicatorActive]} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  boot: {
    alignItems: "center",
    backgroundColor: colors.paper,
    flex: 1,
    justifyContent: "center",
  },
  main: {
    flex: 1,
  },
  login: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },
  loginMark: {
    alignItems: "center",
    backgroundColor: colors.acid,
    borderColor: colors.ink,
    borderRadius: 24,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    marginBottom: 34,
    transform: [{ rotate: "-4deg" }],
    width: 64,
  },
  loginMarkText: {
    color: colors.ink,
    fontFamily: fontBold,
    fontSize: 24,
  },
  loginKicker: {
    color: colors.ember,
    fontFamily: fontBold,
    fontSize: 13,
    letterSpacing: 1.1,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  loginTitle: {
    color: colors.ink,
    fontFamily: fontSerif,
    fontSize: 58,
    letterSpacing: -2,
    lineHeight: 60,
  },
  loginCopy: {
    color: colors.muted,
    fontFamily: fontSans,
    fontSize: 18,
    lineHeight: 27,
    marginBottom: 30,
    marginTop: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    minHeight: 58,
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.acid,
    fontFamily: fontBold,
    fontSize: 18,
  },
  linkButton: {
    alignSelf: "center",
    marginTop: 22,
  },
  linkButtonText: {
    color: colors.blue,
    fontFamily: fontBold,
    fontSize: 15,
  },
  inlineMessage: {
    color: colors.muted,
    fontFamily: fontSans,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 18,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.99 }],
  },
  feedList: {
    paddingBottom: 132,
    paddingHorizontal: 18,
  },
  feedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 18,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },
  smallCaps: {
    color: colors.ember,
    fontFamily: fontBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  feedTitle: {
    color: colors.ink,
    fontFamily: fontSerif,
    fontSize: 44,
    letterSpacing: -1.2,
    lineHeight: 48,
    marginTop: 4,
  },
  feedMeta: {
    color: colors.muted,
    fontFamily: fontMedium,
    fontSize: 14,
    marginTop: 3,
  },
  syncButton: {
    alignItems: "center",
    backgroundColor: colors.acid,
    borderColor: colors.ink,
    borderRadius: 999,
    borderWidth: 2,
    height: 58,
    justifyContent: "center",
    shadowColor: colors.ink,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: 86,
  },
  syncButtonText: {
    color: colors.ink,
    fontFamily: fontBold,
    fontSize: 17,
  },
  searchInput: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 24,
    borderWidth: 2,
    color: colors.ink,
    fontFamily: fontMedium,
    fontSize: 16,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  rail: {
    gap: 10,
    paddingBottom: 18,
    paddingTop: 16,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.55)",
    borderColor: colors.ink,
    borderRadius: 999,
    borderWidth: 1.6,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: colors.ink,
  },
  chipText: {
    color: colors.ink,
    fontFamily: fontBold,
    fontSize: 14,
  },
  chipTextSelected: {
    color: colors.acid,
  },
  notice: {
    color: colors.muted,
    fontFamily: fontMedium,
    fontSize: 14,
    marginBottom: 12,
    marginTop: 4,
  },
  cardWrap: {
    marginBottom: 18,
  },
  cardAccent: {
    borderColor: colors.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    height: "100%",
    left: 8,
    position: "absolute",
    top: 8,
    width: "100%",
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    padding: 20,
  },
  cardMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  author: {
    color: colors.blue,
    fontFamily: fontBold,
    fontSize: 15,
  },
  date: {
    color: colors.muted,
    fontFamily: fontMedium,
    fontSize: 13,
  },
  cardText: {
    color: colors.ink,
    fontFamily: fontMedium,
    fontSize: 22,
    lineHeight: 31,
    marginTop: 16,
  },
  cardBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  categoryLabel: {
    color: colors.ember,
    fontFamily: fontBold,
    fontSize: 15,
  },
  foldHint: {
    color: colors.muted,
    fontFamily: fontBold,
    fontSize: 13,
  },
  cardImage: {
    backgroundColor: colors.paperDeep,
    borderRadius: 22,
    height: 210,
    marginTop: 16,
    overflow: "hidden",
    width: "100%",
  },
  footerLoading: {
    padding: 26,
  },
  footerSpacer: {
    height: 12,
  },
  detail: {
    padding: 20,
    paddingBottom: 60,
  },
  detailTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontFamily: fontBold,
    fontSize: 14,
  },
  secondaryButtonDark: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonDarkText: {
    color: colors.acid,
    fontFamily: fontBold,
    fontSize: 14,
  },
  detailAuthor: {
    color: colors.blue,
    fontFamily: fontBold,
    fontSize: 18,
  },
  detailDate: {
    color: colors.muted,
    fontFamily: fontMedium,
    fontSize: 14,
    marginTop: 4,
  },
  detailText: {
    color: colors.ink,
    fontFamily: fontMedium,
    fontSize: 24,
    lineHeight: 34,
    marginTop: 18,
  },
  sectionTitle: {
    color: colors.ember,
    fontFamily: fontBold,
    fontSize: 13,
    letterSpacing: 1,
    marginTop: 28,
    textTransform: "uppercase",
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  detailSpinner: {
    marginTop: 18,
  },
  detailImage: {
    backgroundColor: colors.paperDeep,
    borderColor: colors.ink,
    borderRadius: radii.md,
    borderWidth: 2,
    height: 280,
    marginTop: 18,
    width: "100%",
  },
  page: {
    padding: 22,
    paddingBottom: 132,
  },
  pageTitle: {
    color: colors.ink,
    fontFamily: fontSerif,
    fontSize: 48,
    letterSpacing: -1.1,
    lineHeight: 52,
    marginBottom: 22,
    marginTop: 5,
  },
  categoryTile: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.ink,
    borderRadius: radii.md,
    borderWidth: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  tileSelected: {
    backgroundColor: colors.acid,
  },
  tileName: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontBold,
    fontSize: 18,
  },
  tileCount: {
    color: colors.ember,
    fontFamily: fontBold,
    fontSize: 18,
  },
  wideAction: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    marginTop: 16,
    padding: 17,
  },
  wideActionText: {
    color: colors.acid,
    fontFamily: fontBold,
    fontSize: 16,
  },
  accountName: {
    color: colors.blue,
    fontFamily: fontBold,
    fontSize: 18,
    marginBottom: 18,
  },
  settingsCard: {
    backgroundColor: colors.card,
    borderColor: colors.ink,
    borderRadius: radii.lg,
    borderWidth: 2,
    overflow: "hidden",
  },
  settingsRow: {
    alignItems: "center",
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  settingsLabel: {
    color: colors.ink,
    fontFamily: fontBold,
    fontSize: 18,
  },
  settingsDetail: {
    color: colors.muted,
    fontFamily: fontSans,
    fontSize: 13,
    marginTop: 4,
  },
  settingsArrow: {
    color: colors.ink,
    fontFamily: fontBold,
    fontSize: 22,
  },
  destructive: {
    color: colors.ember,
  },
  endpoint: {
    color: colors.muted,
    fontFamily: fontSans,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 18,
  },
  nav: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255, 248, 234, 0.92)",
    borderColor: colors.ink,
    borderRadius: 999,
    borderWidth: 2,
    bottom: 18,
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
    left: 18,
    padding: 8,
    position: "absolute",
    right: 18,
  },
  navItem: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 8,
  },
  navIndicator: {
    backgroundColor: "transparent",
    borderRadius: 999,
    height: 5,
    marginBottom: 7,
    width: 28,
  },
  navIndicatorActive: {
    backgroundColor: colors.ember,
  },
  navText: {
    color: colors.muted,
    fontFamily: fontBold,
    fontSize: 14,
  },
  navTextActive: {
    color: colors.ink,
  },
});
