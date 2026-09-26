/**
 * AuthService — customer authentication entry point.
 *
 * Handles customer login, logout, and session establishment. This is the
 * central place where customer authentication is performed for the platform.
 */
import { TokenManager } from "./TokenManager";
import { PermissionValidator } from "./PermissionValidator";

export interface Credentials {
  email: string;
  password: string;
}

export interface Session {
  customerId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AuthService {
  constructor(
    private readonly tokens: TokenManager,
    private readonly permissions: PermissionValidator,
  ) {}

  /** Authenticate a customer and establish a new session. */
  async login(credentials: Credentials): Promise<Session> {
    const customer = await this.verifyCredentials(credentials);
    const accessToken = this.tokens.issueAccessToken(customer.customerId);
    const refreshToken = this.tokens.issueRefreshToken(customer.customerId);
    return {
      customerId: customer.customerId,
      accessToken,
      refreshToken,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
  }

  /** Invalidate a customer's active session on logout. */
  async logout(accessToken: string): Promise<void> {
    this.tokens.revoke(accessToken);
  }

  private async verifyCredentials(
    credentials: Credentials,
  ): Promise<{ customerId: string }> {
    // Demo stub: a real implementation checks a hashed password store.
    if (!credentials.email || !credentials.password) {
      throw new Error("Invalid customer credentials");
    }
    return { customerId: `cust_${credentials.email}` };
  }
}
