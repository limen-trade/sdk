import type { TokenStore } from "./types.js"

export class MemoryTokenStore implements TokenStore {
  private token: string | null = null

  getToken(): string | null {
    return this.token
  }

  setToken(token: string) {
    this.token = token
  }

  clearToken() {
    this.token = null
  }
}

export const defaultTokenStore = new MemoryTokenStore()
