import { Alert } from "react-native";

import * as SecureStore from "expo-secure-store";

export namespace SecureStorage {
  export async function setItem(
    key: string,
    value: string,
    showAlert = true,
  ): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (error) {
      console.log("SecureStorage setItem error:", error);
      if (showAlert) Alert.alert("Error", "Failed to save data");
      return false;
    }
  }

  export async function getItem(
    key: string,
    showAlert = true,
  ): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.log("SecureStorage getItem error:", error);
      if (showAlert) Alert.alert("Error", "Failed to get data");
      return null;
    }
  }

  export async function deleteItem(
    key: string,
    showAlert = true,
  ): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.log("SecureStorage deleteItem error:", error);
      if (showAlert) Alert.alert("Error", "Failed to delete data");
      return false;
    }
  }

  export async function hasItem(key: string): Promise<boolean> {
    const value = await getItem(key, false);
    return value !== null;
  }
}
