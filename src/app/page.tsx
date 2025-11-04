import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-8 text-center max-w-2xl">
        {/* Hero Image */}
        <div className="relative w-64 h-64 md:w-80 md:h-80">
          <Image
            src="/watering.png"
            alt="Watering your knowledge"
            width={320}
            height={320}
            priority
            className="object-contain"
          />
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center gap-6">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight text-slate-100">
            Words of Wisdom
          </h1>
          <p className="text-lg md:text-xl text-slate-400 leading-relaxed max-w-lg">
            Save sentences you want to remember.
            <br />
            Review them regularly and let them grow in your memory.
          </p>
        </div>

        {/* Level Indicators */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/lev1.png"
              alt="Level 1"
              width={48}
              height={48}
              className="opacity-60"
            />
            <span className="text-xs text-slate-500">Fresh</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/lev2.png"
              alt="Level 2"
              width={48}
              height={48}
              className="opacity-60"
            />
            <span className="text-xs text-slate-500">Growing</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Image
              src="/lev3.png"
              alt="Level 3"
              width={48}
              height={48}
              className="opacity-60"
            />
            <span className="text-xs text-slate-500">Mastered</span>
          </div>
        </div>

        {/* CTA Button */}
        <Link
          href="/notes"
          className="mt-8 px-8 py-3 rounded-full bg-slate-100 text-black font-semibold hover:bg-slate-200 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
}
