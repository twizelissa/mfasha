/**
 * Utility to verify Firebase ID tokens on the server without firebase-admin SDK.
 */
export async function verifyUserToken(token: string): Promise<string | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.warn("NEXT_PUBLIC_FIREBASE_API_KEY not configured, token verification skipped.");
      return null;
    }
    
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    });
    
    if (!res.ok) {
      return null;
    }
    
    const data = await res.json();
    const email = data.users?.[0]?.email;
    return email ? email.toLowerCase() : null;
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
}
