import { PrivyClient } from '@privy-io/server-auth';
export const privy = new PrivyClient(process.env.VITE_PRIVY_CLIENT_ID!, process.env.VITE_PRIVY_CLIENT_SECRET!);