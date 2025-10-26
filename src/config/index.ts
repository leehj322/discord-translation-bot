import "dotenv/config";

export const token = process.env.DISCORD_TOKEN;

export function assertConfig(): void {
  if (!token) {
    console.error("Missing DISCORD_TOKEN");
    process.exit(1);
  }
}

export const port: number = Number(process.env.PORT || 0) || 3000;
