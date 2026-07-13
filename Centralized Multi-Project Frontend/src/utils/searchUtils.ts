export interface SearchableItem {
  id: string | number;
  name: string;
  category?: string;
  brand?: string;
  site_name?: string;
  site_id?: string | number;
  tags?: string[];
  route: string;
}

export interface SearchResult extends SearchableItem {
  matchedTerm: string;
  matchType: 'Exact' | 'Synonym' | 'Site' | 'Metadata';
}

const TAGLISH_SYNONYMS: Record<string, string[]> = {
  "rebar": ["kabilya", "bakal", "steel", "10mm", "12mm", "16mm", "deformed bar"],
  "sand": ["buhangin", "fine sand", "white sand", "vibro sand"],
  "gravel": ["graba", "3/4", "crushed stone", "G1"],
  "plywood": ["masonite", "phenolic", "marine plywood", "1/2", "3/4", "wood"],
  "cement": ["sibuyas", "portland", "republic", "holcim", "eagle", "bag"],
};

const SITE_ALIASES: Record<string, string[]> = {
  "tondo": ["odnot", "tdo", "manila north", "r10"],
  "makati": ["mkti", "finlandia", "finlandia project mkti", "ayala"],
  "quezon": ["qc", "commonwealth", "elliptical", "quezon project"],
  "caloocan": ["cal", "monumento", "calooc project", "grace park"],
  "sampaloc": ["samp", "espana", "ust", "sampaloc project"],
  "eum": ["eum project", "main office", "hq", "pentabuild hq"],
};

export function executeGlobalSearch(items: SearchableItem[], rawQuery: string): SearchResult[] {
  const query = rawQuery.toLowerCase().trim();
  if (!query || query.length < 2) return [];

  const results: SearchResult[] = [];
  const addedIds = new Set<string | number>();

  for (const item of items) {
    if (addedIds.has(item.id)) continue;

    const name = (item.name || "").toLowerCase();
    const site = (item.site_name || "").toLowerCase();
    const brand = (item.brand || "").toLowerCase();
    const category = (item.category || "").toLowerCase();
    const tags = (item.tags || []).map(t => t.toLowerCase());

    // 1. Exact Name or Brand Match
    if (name.includes(query) || brand.includes(query)) {
      results.push({ ...item, matchedTerm: query, matchType: 'Exact' });
      addedIds.add(item.id);
      continue;
    }

    // 2. Site Name or Alias/Slang Match
    if (site.includes(query)) {
      results.push({ ...item, matchedTerm: site, matchType: 'Site' });
      addedIds.add(item.id);
      continue;
    }

    let siteAliasMatched = false;
    for (const [canonicalSite, aliases] of Object.entries(SITE_ALIASES)) {
      if (canonicalSite.includes(query) || aliases.some(alias => alias.includes(query) || query.includes(alias))) {
        if (site.includes(canonicalSite) || aliases.some(alias => site.includes(alias))) {
          results.push({ ...item, matchedTerm: canonicalSite.toUpperCase(), matchType: 'Site' });
          addedIds.add(item.id);
          siteAliasMatched = true;
          break;
        }
      }
    }
    if (siteAliasMatched) continue;

    // 3. Taglish Synonym Dictionary Match
    let synonymMatched = false;
    for (const [englishTerm, tagalogTerms] of Object.entries(TAGLISH_SYNONYMS)) {
      const isQuerySynonym = englishTerm.includes(query) || tagalogTerms.some(t => t.includes(query));
      if (isQuerySynonym) {
        const itemMatchesDictionary = name.includes(englishTerm) || 
                                      tags.some(t => t.includes(englishTerm)) ||
                                      tagalogTerms.some(t => name.includes(t));
        if (itemMatchesDictionary) {
          results.push({ ...item, matchedTerm: englishTerm.toUpperCase(), matchType: 'Synonym' });
          addedIds.add(item.id);
          synonymMatched = true;
          break;
        }
      }
    }
    if (synonymMatched) continue;

    // 4. Metadata & Category Match
    if (category.includes(query) || tags.some(t => t.includes(query))) {
      results.push({ ...item, matchedTerm: query, matchType: 'Metadata' });
      addedIds.add(item.id);
    }
  }

  return results;
}