import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "bookmarkfold.sessionToken";

export function getStoredToken() {
  if (Platform.OS === "web") {
    return Promise.resolve(globalThis.localStorage?.getItem(TOKEN_KEY) || null);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string | null) {
  if (Platform.OS === "web") {
    if (!token) globalThis.localStorage?.removeItem(TOKEN_KEY);
    else globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }

  if (!token) {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}
