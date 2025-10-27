import "dotenv/config";

export const token = process.env.DISCORD_TOKEN;

export function assertConfig(): void {
  if (!token) {
    console.error("Missing DISCORD_TOKEN");
    process.exit(1);
  }
  if (!process.env.DEEPL_AUTH_KEY) {
    console.warn(
      "DEEPL_AUTH_KEY is not set – DeepL translation will be unavailable."
    );
  }
}

export const port: number = Number(process.env.PORT || 0) || 3000;
