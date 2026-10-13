import { 
  exchangeNpssoForAccessCode, 
  exchangeCodeForAccessToken,
  getProfileFromUserName
} from "psn-api";

const npsso = "DydcDcBSYkHWCcXrRl7b3FB4SdRUX7rttokwz3rZ9FTXRn0lOWHeD3lKx9OekO2m";

async function check() {
  const code = await exchangeNpssoForAccessCode(npsso);
  const auth = await exchangeCodeForAccessToken(code);
  const jwt = JSON.parse(Buffer.from(auth.accessToken.split('.')[1], 'base64').toString());
  const accountId = jwt.account_id;
  console.log("Account ID:", accountId);

  // Test endpoints
  const endpoints = [
    `https://m.np.playstation.com/api/userProfile/v1/internal/users/${accountId}/profiles`,
    `https://us-prof.np.community.playstation.net/userProfile/v1/users/supposed-giant83/profile2?fields=npId,onlineId,accountId,avatarUrls,plus,aboutMe`,
    `https://m.np.playstation.com/api/cpss/v1/users/me/subscriptions`,
    `https://m.np.playstation.com/api/cpss/v1/users/${accountId}/subscriptions`,
    `https://dms.api.playstation.com/api/v1/users/me/entitlements`,
    `https://web.np.playstation.com/api/subscription/v1/users/me`,
    `https://trans.api.playstation.com/api/v1/users/me/subscriptions`,
    `https://ca.account.sony.com/api/v1/users/me/subscriptions`
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json"
        }
      });
      console.log(`\nURL: ${url} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log("Response:", text.slice(0, 500));
      }
    } catch (e) {
      console.log(`Error calling ${url}:`, e.message);
    }
  }
}

check().catch(console.error);
