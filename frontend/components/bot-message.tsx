import { MessageText } from "@/components/message-text"

// 챗봇 답변을 읽기 쉽게 — 문단을 나누고, "예: …", "지원 지역: …" 같은 목록 줄은 이름표 + 칩으로 보여 준다.
const CHIP_LABELS = ["지원 지역"]
// "예: …" 줄은 입력창 안내에 이미 예시가 있어 따로 보여 주지 않는다
const HIDDEN_LABELS = ["예"]
const FIELD_LINE = /^([가-힣A-Za-z ]{1,8})\s*:\s*(.+)$/

// onChip을 주면(지금 답할 차례인 메시지) "지원 지역" 칩을 눌러 바로 그 지역으로 보낼 수 있다.
export function BotMessage({ text, onChip }: { text: string; onChip?: (value: string) => void }) {
  const paragraphs = String(text || "").split(/\n\s*\n/).map((p) => p.split("\n").filter((l) => l.trim()))
  return (
    <div className="flex flex-col gap-3.5 text-[14.5px] leading-7">
      {paragraphs.map((lines, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          {lines.map((line, j) => {
            // 링크 줄(https://…)은 이름표로 나누지 않는다
            const m = /^\s*https?:\/\//.test(line) ? null : line.match(FIELD_LINE)
            if (m && !/^https?/.test(m[2])) {
              const [, label, value] = m
              if (HIDDEN_LABELS.includes(label.trim())) return null
              if (CHIP_LABELS.includes(label.trim())) {
                return (
                  <div key={j} className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="mr-1 text-[12px] uppercase tracking-[0.04em] text-muted-foreground">{label.trim()}</span>
                    {value.split(/\s*,\s*/).filter(Boolean).map((v) =>
                      onChip ? (
                        <button
                          key={v}
                          type="button"
                          onClick={() => onChip(v)}
                          className="border border-border bg-background px-2.5 py-1 text-[12.5px] leading-5 text-foreground transition-colors hover:border-accent hover:text-accent"
                        >
                          {v}
                        </button>
                      ) : (
                        <span key={v} className="border border-border bg-background px-2 py-0.5 text-[12.5px] leading-5 text-foreground/80">{v}</span>
                      ),
                    )}
                  </div>
                )
              }
              return (
                <p key={j} className="flex gap-3">
                  <span className="w-[4.5rem] shrink-0 text-[12.5px] text-muted-foreground">{label.trim()}</span>
                  <span className="min-w-0 flex-1"><MessageText text={value} /></span>
                </p>
              )
            }
            return <MessageText key={j} text={line} />
          })}
        </div>
      ))}
    </div>
  )
}
