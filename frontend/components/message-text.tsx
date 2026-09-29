// 챗봇 말풍선 텍스트 — URL을 링크로 바꿔 보여준다(플로팅 챗봇·플래너 공용)
export function MessageText({ text }: { text: string }) {
  const parts = String(text || "").split(/(https?:\/\/[^\s]+)/g)
  return (
    <p className="m-0 whitespace-pre-wrap leading-relaxed [overflow-wrap:anywhere]">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  )
}
