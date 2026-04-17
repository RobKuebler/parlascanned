import { Piazzolla } from "next/font/google";

const piazzolla = Piazzolla({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["italic", "normal"],
  display: "swap",
});

/** Shared page header — editorial masthead style matching the homepage. */
export function PageHeader({
  color,
  label,
  title,
  description,
}: {
  color: string;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      {/* Structural top rule */}
      <div className="mb-5" style={{ height: 3, background: "#1E1B5E" }} />

      {/* Eyebrow — category label in page accent color */}
      <p
        className="text-[10px] font-extrabold tracking-[0.22em] uppercase mb-2"
        style={{ color }}
      >
        {label}
      </p>

      {/* Page title in editorial serif */}
      <h1
        className={`${piazzolla.className} font-bold italic leading-none tracking-tight mb-4`}
        style={{ color: "#1E1B5E", fontSize: "clamp(30px, 4vw, 46px)" }}
      >
        {title}
      </h1>

      {/* Description */}
      <p
        className="text-[14px] leading-relaxed"
        style={{ color: "#5a556b", maxWidth: "60ch" }}
      >
        {description}
      </p>

      {/* Divider */}
      <div className="mt-6" style={{ height: 1, background: "#dddaf0" }} />
    </div>
  );
}
