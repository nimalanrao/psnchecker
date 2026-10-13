import { 
  exchangeNpssoForAccessCode, 
  exchangeCodeForAccessToken,
  call
} from "psn-api";

const npsso = "DydcDcBSYkHWCcXrRl7b3FB4SdRUX7rttokwz3rZ9FTXRn0lOWHeD3lKx9OekO2m";

async function test() {
  const code = await exchangeNpssoForAccessCode(npsso);
  const auth = await exchangeCodeForAccessToken(code);

  // Let's test GraphQL query getPurchasedGameList with different parameters
  const GRAPHQL_URL = "https://web.np.playstation.com/api/graphql/v1/op";
  const HASH_PURCHASED = "827a423f6a8ddca4107ac01395af2ec0eafd8396fc7fa204aaf9b7ed2eefa168";

  // Let's try to see if there is an active subscription field
  const url = new URL(GRAPHQL_URL);
  url.searchParams.set("operationName", "getPurchasedGameList");
  url.searchParams.set("variables", JSON.stringify({
    isActive: true,
    platform: ["ps4", "ps5"],
    size: 5,
    start: 0,
    sortBy: "ACTIVE_DATE",
    sortDirection: "desc",
    membership: "PS_PLUS"
  }));
  url.searchParams.set("extensions", JSON.stringify({
    persistedQuery: { version: 1, sha256Hash: HASH_PURCHASED }
  }));

  const res = await call({ url: url.toString() }, auth);
  console.log("PS Plus games query result:", JSON.stringify(res, null, 2));
}

test().catch(console.error);
