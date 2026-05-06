export type EmailServerConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
};

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function buildEmailServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): EmailServerConfig {
  const port = Number(env.EMAIL_SERVER_PORT ?? "1025");
  const secure = parseBoolean(env.EMAIL_SERVER_SECURE) ?? port === 465;
  const user = env.EMAIL_SERVER_USER;
  const pass = env.EMAIL_SERVER_PASSWORD;

  return {
    host: env.EMAIL_SERVER_HOST ?? "localhost",
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  };
}
