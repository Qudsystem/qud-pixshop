"use client";

import React, { useEffect, useState } from "react";

interface QudAdItem {
  id: string;
  tag: string;
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  theme?: string;
}

interface QudAdFeed {
  enabled: boolean;
  officeAiBanner?: {
    titleAr: string;
    titleEn: string;
    url: string;
  };
  ads: QudAdItem[];
}

export interface QudEcosystemBannerProps {
  projectName: string;
  category: string;
  paidTier?: boolean;
}

const AD_FEED_URLS = [
  "/ads/qud-ad-slot.json",
  "https://cdn.jsdelivr.net/gh/Qudsystem/qudsystem-website@main/public/ads/qud-ad-slot.json",
  "https://raw.githubusercontent.com/Qudsystem/qudsystem-website/main/public/ads/qud-ad-slot.json",
];

const FALLBACK_FEED: QudAdFeed = {
  enabled: true,
  officeAiBanner: {
    titleAr: "قريباً / قادم: حزمة Qud Office AI المتكاملة",
    titleEn: "Coming Soon: Qud Office AI Suite",
    url: "https://github.com/Qudsystem",
  },
  ads: [
    {
      id: "qud-office-ai-2026",
      tag: "إعلان QudSystem",
      title: "قريباً: حزمة Qud Office AI — الجيل القادم من برمجيات الأعمال والذكاء الاصطناعي",
      description:
        "النسخة المدفوعة بالباقات المتاحة قريباً في كل منتج توفر تجربة كاملة 100% بدون إعلانات.",
      ctaText: "استكشف المنظومة",
      ctaUrl: "https://github.com/Qudsystem",
    },
  ],
};

export function QudEcosystemBanner({
  projectName,
  category,
  paidTier = false,
}: QudEcosystemBannerProps) {
  const [feed, setFeed] = useState<QudAdFeed>(FALLBACK_FEED);
  const [isPro, setIsPro] = useState<boolean>(paidTier);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    try {
      const tier = window.localStorage.getItem("qud_license_tier");
      if (tier === "pro" || tier === "enterprise" || tier === "paid") {
        setIsPro(true);
      }
      if (window.sessionStorage.getItem("qud_ad_dismissed") === "1") {
        setDismissed(true);
      }
    } catch {}

    let active = true;
    (async () => {
      for (const url of AD_FEED_URLS) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) continue;
          const data = (await res.json()) as QudAdFeed;
          if (active && data && Array.isArray(data.ads)) {
            setFeed(data);
            return;
          }
        } catch {}
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const activeAd = feed.ads?.[0];

  return (
    <section
      dir="rtl"
      aria-label="QudSystem Ecosystem Footer and Updatable Ad Slot"
      className="w-full border-t border-blue-500/30 bg-slate-950 text-slate-200 px-4 py-5 mt-8"
    >
      <div className="max-w-6xl mx-auto space-y-3">
        {!isPro && !dismissed && feed.enabled && activeAd && (
          <div className="rounded-xl border border-blue-400/30 bg-gradient-to-l from-slate-900 via-blue-950 to-indigo-950 p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1 flex-1 min-w-[240px]">
              <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {activeAd.tag}
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white">{activeAd.title}</h4>
              <p className="text-xs text-slate-300">{activeAd.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={activeAd.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                {activeAd.ctaText}
              </a>
              <button
                type="button"
                onClick={() => {
                  setDismissed(true);
                  try {
                    window.sessionStorage.setItem("qud_ad_dismissed", "1");
                  } catch {}
                }}
                className="px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs text-slate-200"
                aria-label="إغلاق الإعلان مؤقتاً"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-slate-800">
          <div className="font-medium text-slate-100">
            من تقديم شركة <strong className="text-blue-400">QudSystem</strong> •{" "}
            <span>{projectName}</span>{" "}
            <span className="text-slate-400">({category}) — ضمن حزمة برمجية متكاملة</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-200 border border-violet-500/30 font-semibold">
              🚀 {feed.officeAiBanner?.titleAr || "قريباً / قادم: حزمة Qud Office AI"}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
              {isPro
                ? "✓ النسخة المدفوعة — تجربة كاملة بدون إعلانات"
                : "النسخة المدفوعة (بدون إعلانات) متاحة قريباً بالباقات"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default QudEcosystemBanner;
