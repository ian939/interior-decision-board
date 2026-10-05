const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        skipped: true,
        reason: "TELEGRAM_BOT_TOKEN 환경 변수가 없어 실제 Bot API 검증을 건너뜁니다.",
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

try {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json();
  console.log(
    JSON.stringify(
      {
        ok: response.ok && payload.ok === true,
        status: response.status,
        bot: payload.ok
          ? { id: payload.result.id, username: payload.result.username, canJoinGroups: payload.result.can_join_groups }
          : null,
        description: payload.ok ? null : payload.description,
      },
      null,
      2,
    ),
  );
  if (!response.ok || payload.ok !== true) process.exit(1);
} catch (error) {
  console.error(
    JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2),
  );
  process.exit(1);
}
