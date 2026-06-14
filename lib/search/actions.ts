"use server"

import { searchAll } from "./queries"
import type { SearchResults } from "./types"

export async function searchAction(term: string): Promise<SearchResults> {
  return searchAll(term)
}
