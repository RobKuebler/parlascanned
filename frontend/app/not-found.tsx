import Link from "next/link";
import { piazzolla } from "@/lib/fonts";

export default function NotFound() {
  return (
    <div className="flex flex-col pt-8">
      <div
        style={{ height: 3, background: "var(--color-navy)", marginBottom: 20 }}
      />
      <p
        className="text-[10px] font-extrabold tracking-[0.22em] uppercase mb-4"
        style={{ color: "var(--color-purple)" }}
      >
        Fehler
      </p>
      <h1
        className={`${piazzolla.className} font-bold italic leading-none tracking-tight mb-4`}
        style={{
          color: "var(--color-navy)",
          fontSize: "clamp(60px, 10vw, 120px)",
        }}
      >
        404
      </h1>
      <p
        className="text-[15px] mb-6"
        style={{ color: "#5a556b", maxWidth: "40ch" }}
      >
        Diese Seite existiert nicht.
      </p>
      <Link
        href="/"
        className="text-[13px] font-bold transition-colors duration-150 hover:text-[var(--color-purple)]"
        style={{ color: "var(--color-navy)" }}
      >
        ← Zurück zur Startseite
      </Link>
    </div>
  );
}
