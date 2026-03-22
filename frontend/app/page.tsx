import Link from 'next/link'
import { Footer } from '@/components/ui/Footer'

const FEATURES = [
  {
    href: '/vote-map',
    title: 'Abstimmungslandkarte',
    description:
      'KI-generierte Karte aller Abgeordneten. Nähe = ähnliches Abstimmungsverhalten. Wähle Abgeordnete per Box-Auswahl für die Heatmap.',
  },
  {
    href: '/party-profile',
    title: 'Parteiprofil',
    description:
      'Altersverteilung, Geschlecht, Berufe und Ausbildung der Fraktionen im Vergleich.',
  },
  {
    href: '/sidejobs',
    title: 'Nebeneinkünfte',
    description:
      'Offengelegte Nebentätigkeiten und Einkünfte nach Partei, Kategorie und Themenfeld.',
  },
]

export default function Home() {
  return (
    <>
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
          Parlascanned
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed">
          Daten und KI-Analyse zum Deutschen Bundestag. Wer stimmt mit wem?
          Wo verlaufen die echten Trennlinien?
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {FEATURES.map(({ href, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-gray-200 p-6 hover:border-gray-400 hover:shadow-sm transition-all"
          >
            <h2 className="font-semibold text-gray-900 mb-2">{title}</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>
      <Footer />
    </>
  )
}
