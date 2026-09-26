/**
 * TokenManager — issues and refreshes JWT access and refresh tokens.
 *
 * Responsible for access token issuance, refresh token rotation, and token
 * revocation. This is where token refresh logic lives.
 */
export class TokenManager {
  private readonly revoked = new Set<string>();

  /** Issue a short-lived access token for a customer. */
  issueAccessToken(customerId: string): string {
    return this.sign({ sub: customerId, type: "access", ttl: 900 });
  }

  /** Issue a long-lived refresh token for a customer. */
  issueRefreshToken(customerId: string): string {
    return this.sign({ sub: customerId, type: "refresh", ttl: 1209600 });
  }

  /**
   * Exchange a valid refresh token for a new access token. Implements refresh
   * token rotation: the old refresh token is revoked and a new one returned.
   */
  refreshAccessToken(refreshToken: string): {
    accessToken: string;
    refreshToken: string;
  } {
    if (this.revoked.has(refreshToken)) {
      throw new Error("Refresh token has been revoked");
    }
    const claims = this.verify(refreshToken);
    this.revoke(refreshToken);
    return {
      accessToken: this.issueAccessToken(claims.sub),
      refreshToken: this.issueRefreshToken(claims.sub),
    };
  }

  /** Revoke a token so it can no longer be used. */
  revoke(token: string): void {
    this.revoked.add(token);
  }

  private sign(payload: {
    sub: string;
    type: string;
    ttl: number;
  }): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `demo.${body}.signature`;
  }

  private verify(token: string): { sub: string; type: string } {
    const [, body] = token.split(".");
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  }
}
