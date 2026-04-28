import { Alert } from "react-native";

import { storage } from "@src/utils/mmkv";

export namespace AsyncStorage {
  /**
   * Store a string value with the given key
   * @param key Storage key
   * @param value String value to store
   * @returns Promise indicating success
   */
  export function setItem(key: string, value: string): boolean {
    try {
      storage.set(key, value);
      return true;
    } catch (error) {
      console.log("AsyncStorage setItem error:", error);
      Alert.alert("Storage Error", "Failed to save data");
      return false;
    }
  }

  /**
   * Store an object value with the given key
   * @param key Storage key
   * @param value Object to store
   * @returns Promise indicating success
   */
  export function setObject<T>(key: string, value: T): boolean {
    try {
      const jsonValue = JSON.stringify(value);
      storage.set(key, jsonValue);
      return true;
    } catch (error) {
      console.log("AsyncStorage setObject error:", error);
      Alert.alert("Storage Error", "Failed to save object data");
      return false;
    }
  }

  /**
   * Retrieve a string value for the given key
   * @param key Storage key
   * @returns The stored string value or null
   */
  export function getItem(key: string): string | null {
    try {
      return storage.getString(key) || null;
    } catch (error) {
      console.log("AsyncStorage getItem error:", error);
      Alert.alert("Storage Error", "Failed to retrieve data");
      return null;
    }
  }

  /**
   * Retrieve and parse an object value for the given key
   * @param key Storage key
   * @returns The stored object or null
   */
  export function getObject<T>(key: string): T | null {
    try {
      const jsonValue = storage.getString(key);
      return jsonValue != null ? (JSON.parse(jsonValue) as T) : null;
    } catch (error) {
      console.log("AsyncStorage getObject error:", error);
      Alert.alert("Storage Error", "Failed to retrieve object data");
      return null;
    }
  }

  /**
   * Remove an item from storage
   * @param key Storage key
   * @returns Promise indicating success
   */
  export async function removeItem(key: string): Promise<boolean> {
    try {
      storage.delete(key);
      return true;
    } catch (error) {
      console.log("AsyncStorage removeItem error:", error);
      Alert.alert("Storage Error", "Failed to remove data");
      return false;
    }
  }

  /**
   * Get all keys stored in AsyncStorage
   * @returns Array of keys or empty array
   */
  export function getAllKeys(): readonly string[] {
    try {
      const keys = storage.getAllKeys();
      return keys;
    } catch (error) {
      console.log("AsyncStorage getAllKeys error:", error);
      Alert.alert("Storage Error", "Failed to retrieve keys");
      return [];
    }
  }

  /**
   * Retrieve multiple items at once
   * @param keys Array of keys to retrieve
   * @returns Object with key-value pairs
   */
  export async function multiGet(
    keys: string[],
  ): Promise<Record<string, string | null>> {
    try {
      const result: Record<string, string | null> = {};
      for (const key of keys) {
        result[key] = storage.getString(key) ?? null;
      }
      return result;
    } catch (error) {
      console.log("AsyncStorage multiGet error:", error);
      Alert.alert("Storage Error", "Failed to retrieve multiple items");
      return {};
    }
  }

  /**
   * Store multiple items at once
   * @param items Object with key-value pairs to store
   * @returns Promise indicating success
   */
  export async function multiSet(
    items: Record<string, string>,
  ): Promise<boolean> {
    try {
      const keyValuePairs = Object.entries(items);
      for (const [key, value] of keyValuePairs) {
        storage.set(key, value);
      }
      return true;
    } catch (error) {
      console.log("AsyncStorage multiSet error:", error);
      Alert.alert("Storage Error", "Failed to save multiple items");
      return false;
    }
  }

  /**
   * Check if a key exists in storage
   * @param key Storage key
   * @returns Boolean indicating if key exists
   */
  export async function hasKey(key: string): Promise<boolean> {
    try {
      const keys = storage.getString(key);
      return keys !== null && keys !== undefined && keys !== "";
    } catch (error) {
      console.log("AsyncStorage hasKey error:", error);
      return false;
    }
  }

  /**
   * Clear all data from AsyncStorage
   * @returns Promise indicating success
   */
  export async function clear(): Promise<boolean> {
    try {
      storage.clearAll();
      return true;
    } catch (error) {
      console.log("AsyncStorage clear error:", error);
      Alert.alert("Storage Error", "Failed to clear storage");
      return false;
    }
  }

  /**
   * Get the total size of data stored (approximate)
   * @returns Size in bytes
   */
  // export function getSize(): number {
  //   try {
  //     const keys = storage.getAllKeys();
  //     return keys.reduce((size, key) => {
  //       const value = storage.getString(key);
  //       return size + key.length + (value?.length || 0);
  //     }, 0);
  //   } catch (error) {
  //     console.log("AsyncStorage getSize error:", error);
  //     return 0;
  //   }
  // }
}
