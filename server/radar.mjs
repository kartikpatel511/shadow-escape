// Step 04 — mutually visible, time-limited location tracking.
// The server alone owns balances, purchases and the coordinates sent to a buyer.
export const STARTING_COINS = 300;
export const MAX_COINS = 300;
export const REVEAL_COST = 20;
export const REVEAL_DURATION_MS = 10_000;

export function pairKey(a,b){return [a,b].sort().join(':');}

// Returns the current private contacts for exactly one player. Expired links
// are never exposed, even if their eventual garbage collection is delayed.
export function contactsFor(room, player, now = Date.now()) {
  const contacts = [];
  for (const link of room.reveals.values()) {
    if (link.expiresAt <= now || (link.a !== player.id && link.b !== player.id)) continue;
    const otherId = link.a === player.id ? link.b : link.a;
    const target = room.players.get(otherId);
    if (!target) continue;
    contacts.push({id:target.id,name:target.name,role:target.role,
      x:target.x,z:target.z,remainingMs:link.expiresAt-now,source:'reciprocal'});
  }
  return contacts;
}

export function expireReveals(room,now=Date.now()){
  for(const [key,link] of room.reveals){
    if(link.expiresAt<=now||!room.players.has(link.a)||!room.players.has(link.b))room.reveals.delete(key);
  }
}
