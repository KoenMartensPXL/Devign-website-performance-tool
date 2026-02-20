"use client";

import Image from "next/image";
import { Instagram, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-black">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* TOP ROW */}
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 text-sm text-white/80">
            <div className="space-y-1">
              <div className="text-white">Vandaag bereikbaar</div>
              <div>van 8u30 tot 17u00</div>
            </div>
            <div className="space-y-1">
              <div className="text-white">+31 (0)45 20 518 56</div>
              <div>info@pixelplus.nl</div>
            </div>
            <div className="space-y-1">
              <div className="text-white">Raadhuisstraat 12</div>
              <div>6191 KB Beek NL</div>
            </div>
          </div>

          <div className="flex justify-start md:justify-end">
            <Image
              src="/brand/pixelplus+Logo.png"
              alt="Pixelplus"
              width={260}
              height={60}
              className="h-12 w-auto object-contain opacity-95"
              priority
            />
          </div>
        </div>

        <div className="my-10 h-px w-full" />

        {/* BOTTOM ROW (one line) */}
        <div className="flex items-center justify-between gap-10 overflow-x-auto whitespace-nowrap py-2 text-sm text-white/70">
          <div className="flex items-center gap-8">
            <a href="#" className="hover:text-white">
              Privacy
            </a>
            <a href="#" className="hover:text-white">
              Cookies
            </a>
            <a href="#" className="hover:text-white">
              Voorwaarden
            </a>
            <span>KvK: 5138 4175</span>
            <span>BTW: NL8232 55669 B01</span>
          </div>

          <div className="flex items-center gap-5">
            <a href="#" className="opacity-80 hover:opacity-100">
              <Linkedin className="h-5 w-5" />
            </a>
            <a href="#" className="opacity-80 hover:opacity-100">
              <Instagram className="h-5 w-5" />
            </a>
          </div>

          <div className="flex items-center gap-8">
            <span className="opacity-80 hover:opacity-100 transition">
              Google Partner
            </span>
            <span className="opacity-80 hover:opacity-100 transition">
              Leadinfo
            </span>
            <span className="opacity-80 hover:opacity-100 transition">
              TAGGRS
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
