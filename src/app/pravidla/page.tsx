import { BackLink } from "@/components/ui/back-link";
import {
  Trophy,
  Star,
  Target,
  Crown,
  Swords,
  Wallet,
  CalendarClock,
  HelpCircle,
} from "lucide-react";

export const metadata = { title: "Jak se hraje" };

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-white/45 bg-white/35 p-4 shadow-lg shadow-black/20 backdrop-blur-lg dark:border-neutral-700/45 dark:bg-neutral-800/35 dark:shadow-black/60">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="text-yellow-600 dark:text-accent">{icon}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm text-neutral-600 dark:text-neutral-300">{children}</div>
    </section>
  );
}

function Pts({ n }: { n: number }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-accent/20 px-1.5 text-xs font-bold text-yellow-700 tabular-nums dark:text-accent">
      +{n}
    </span>
  );
}

export default function RulesPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
      <div>
        <BackLink href="/profile">Zpět na profil</BackLink>
        <h1 className="mt-1 text-2xl font-bold">Jak se hraje</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Tipuješ výsledky zápasů galavečerů OKTAGON a soupeříš s partou o body i o startovné.
          Tady je všechno, co potřebuješ vědět.
        </p>
      </div>

      <Card icon={<Swords className="size-5" />} title="Co se u každého zápasu tipuje">
        <p>U každého zápasu na kartě určuješ tři věci:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <strong>Vítěze</strong> — kdo zápas vyhraje.
          </li>
          <li>
            <strong>Způsob ukončení</strong> — KO/TKO, submise, nebo rozhodnutím.
          </li>
          <li>
            <strong>Kolo</strong> — ve kterém kole to skončí (u rozhodnutí kolo neřešíš).
          </li>
        </ul>
        <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          Tip se uloží, až vyplníš vítěze i způsob (a kolo, pokud nejde o rozhodnutí). Samotný vítěz bez
          zbytku se neuloží — hlídá tě u toho žlutá hláška.
        </p>
      </Card>

      <Card icon={<Target className="size-5" />} title="Kolik je za co bodů">
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2">
            <Pts n={1} /> správný vítěz
          </li>
          <li className="flex items-center gap-2">
            <Pts n={1} /> správný způsob ukončení
          </li>
          <li className="flex items-center gap-2">
            <Pts n={1} /> správné kolo (nebo rozhodnutí bez kola)
          </li>
        </ul>
        <p>
          Za jeden zápas můžeš dostat maximálně <strong>3 body</strong>. Body se počítají jen tehdy,
          když trefíš vítěze — bez správného vítěze je celý zápas za nula.
        </p>
      </Card>

      <Card icon={<Star className="size-5" />} title="Jistotka (×2)">
        <p>
          U jednoho zápasu na galavečer si můžeš dát <strong>jistotku</strong> — hvězdičku na zápas, kde
          si nejvíc věříš. Body z toho zápasu se ti pak počítají <strong>dvakrát</strong>. Dá se přehodit,
          dokud se tipy nezamknou.
        </p>
      </Card>

      <Card icon={<Trophy className="size-5" />} title="Bonusy">
        <p className="flex items-start gap-2">
          <Pts n={2} />
          <span>
            <strong>Fight of the Night</strong> — tipni, který zápas vyhlásí jako nejlepší večera.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <Pts n={5} />
          <span>
            <strong>Perfektní karta</strong> — když trefíš vítěze úplně všech zápasů na kartě (stačí
            jeden špatně a bonus propadá).
          </span>
        </p>
      </Card>

      <Card icon={<CalendarClock className="size-5" />} title="Uzávěrka">
        <p>
          Tipy jdou zadávat a měnit až do <strong>uzávěrky</strong> — obvykle těsně před startem
          galavečera. Po zámku už se nedá nic upravit a začíná se bodovat zápas po zápasu, jak přicházejí
          výsledky.
        </p>
      </Card>

      <Card icon={<Crown className="size-5" />} title="Žebříček a pořadí">
        <p>
          Body se sčítají za celý galavečer i za celou sezónu. Když mají dva stejně bodů, rozhoduje kdo
          trefil víc vítězů, pak kdo měl perfektní kartu, a nakonec kdo tipoval dřív.
        </p>
        <p>
          Můžeš si taky založit <strong>privátní skupinu</strong> a měřit se jen s vybranou partou.
        </p>
      </Card>

      <Card icon={<Wallet className="size-5" />} title="Startovné">
        <p>
          U galavečerů se startovným jde o drobný vklad. Kdo skončí v žebříčku toho večera první,
          startovné bere. Peníze si posíláte mezi sebou napřímo — vítěz nastaví číslo účtu v profilu a
          ostatním se po vyhodnocení ukáže QR platba. Aplikace žádné peníze nedrží ani nepřeposílá.
        </p>
      </Card>

      <Card icon={<HelpCircle className="size-5" />} title="Ještě něco nejasného?">
        <p>Napiš do kecárny u galavečera — někdo z party poradí.</p>
      </Card>
    </div>
  );
}
