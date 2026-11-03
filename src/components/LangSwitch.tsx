import { getLang, setLang, type Lang } from "@/lib/i18n";

export function LangSwitch({ className = "" }: { className?: string }) {
  const cur = getLang();
  return (
    <div className={`inline-flex overflow-hidden rounded-md border text-xs ${className}`}>
      {(["ru", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== cur && setLang(l)}
          className={`px-2 py-1 font-semibold uppercase ${l === cur ? "bg-primary text-primary-foreground" : "opacity-70 hover:opacity-100"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
