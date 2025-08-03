"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type * as THREE from "three";
import { backgrounds } from "@/components/background/background-preview-selector";

type GameMode = "two-player" | "vs-ai" | "online";

interface TitlePageProps {
  onStartGame: (mode: GameMode) => void;
}

const GAME_MODES = [
  {
    id: "two-player" as GameMode,
    name: "2プレイヤー",
    description: "友達と対戦",
    icon: "👥",
    color: "from-blue-500 to-purple-600",
    available: true,
  },
  {
    id: "vs-ai" as GameMode,
    name: "vs AI",
    description: "コンピューター対戦",
    icon: "🤖",
    color: "from-green-500 to-teal-600",
    available: true,
  },
  {
    id: "online" as GameMode,
    name: "オンライン",
    description: "オンライン対戦",
    icon: "🌐",
    color: "from-orange-500 to-red-600",
    available: true,
  },
];

export function TitlePage({ onStartGame }: TitlePageProps) {
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [randomBackground, setRandomBackground] = useState<any>(null);

  useEffect(() => {
    // ページロード時のアニメーション
    const timer = setTimeout(() => setIsLoaded(true), 100);

    // ランダムに背景を選択
    const randomIndex = Math.floor(Math.random() * backgrounds.length);
    setRandomBackground(backgrounds[randomIndex]);

    return () => clearTimeout(timer);
  }, []);

  // BackgroundComponentが準備されるまで何も表示しない
  if (!randomBackground) return null;

  const BackgroundComponent = randomBackground.component;

  return (
    <>
      <title>3D Connect Four - 3D4目並べゲーム</title>
      <div className="relative min-h-screen w-full overflow-hidden bg-black">
        {/* バックグラウンドビジュアル */}
        <div className="absolute inset-0 z-0">
          <BackgroundComponent />
        </div>

        {/* グリッド背景パターン */}
        <div className="fixed inset-0 opacity-5">
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* スクロール可能なメインコンテンツ */}
        <div className="relative z-10 w-full min-h-screen overflow-y-auto">
          <div className="container mx-auto px-4 py-8 md:py-12">
            <div
              className={`max-w-4xl mx-auto transition-all duration-1000 ${
                isLoaded
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
            >
              {/* タイトルセクション */}
              <div className="text-center mb-8 md:mb-12">
                <div className="relative">
                  {/* グロー効果 */}
                  <div className="absolute inset-0 blur-xl">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                      3D Connect Four
                    </h1>
                  </div>

                  {/* メインタイトル */}
                  <h1 className="relative text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    3D Connect Four
                  </h1>
                </div>

                <div className="mt-4 md:mt-6 space-y-2">
                  <p className="text-xl md:text-2xl lg:text-3xl font-bold text-white/90">
                    3D4目並べゲーム
                  </p>
                  <p className="text-base md:text-lg text-white/70 max-w-md mx-auto">
                    立体空間で繰り広げる、新次元の戦略バトル
                  </p>
                </div>

                {/* 装飾的な線 */}
                <div className="mt-6 md:mt-8 flex items-center justify-center space-x-4">
                  <div className="h-px w-12 md:w-16 bg-gradient-to-r from-transparent to-blue-500"></div>
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                  <div className="h-px w-12 md:w-16 bg-gradient-to-l from-transparent to-pink-500"></div>
                </div>
              </div>

              {/* ゲームモード選択 */}
              <Card className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl mb-8">
                <CardContent className="p-6 md:p-8">
                  <div className="text-center mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                      ゲームモードを選択
                    </h2>
                    <p className="text-white/70 text-sm md:text-base">
                      あなたの挑戦を選んでください
                    </p>
                  </div>

                  <div className="grid gap-3 md:gap-4">
                    {GAME_MODES.map((mode, index) => (
                      <div
                        key={mode.id}
                        className={`transition-all duration-300 ${
                          isLoaded
                            ? "opacity-100 translate-x-0"
                            : "opacity-0 translate-x-8"
                        }`}
                        style={{ transitionDelay: `${index * 150}ms` }}
                      >
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => mode.available && onStartGame(mode.id)}
                          disabled={!mode.available}
                          onMouseEnter={() => setHoveredMode(mode.id)}
                          onMouseLeave={() => setHoveredMode(null)}
                          className={`
                            w-full p-4 md:p-6 h-auto text-left relative overflow-hidden group
                            bg-gradient-to-r ${mode.color} 
                            hover:shadow-xl hover:shadow-purple-500/20
                            transform transition-all duration-300 hover:scale-[1.02]
                            border-2 border-white/20 hover:border-white/40
                            ${
                              hoveredMode === mode.id
                                ? "scale-[1.02] shadow-xl shadow-purple-500/20"
                                : ""
                            }
                          `}
                        >
                          {/* 背景グロー効果 */}
                          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                          <div className="relative flex items-center space-x-3 md:space-x-4">
                            <div className="text-2xl md:text-3xl transform transition-transform duration-300 group-hover:scale-110">
                              {mode.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-lg md:text-xl font-bold text-white mb-1">
                                {mode.name}
                              </div>
                              <div className="text-white/80 text-sm md:text-base">
                                {mode.description}
                              </div>
                            </div>
                            <div className="text-white/60 transform transition-transform duration-300 group-hover:translate-x-1 text-lg">
                              →
                            </div>
                          </div>

                          {!mode.available && (
                            <div className="absolute top-2 right-2">
                              <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">
                                準備中
                              </span>
                            </div>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 遊び方セクション */}
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 shadow-xl">
                <CardContent className="p-6 md:p-8">
                  <div className="text-center mb-6">
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                      <span className="text-xl md:text-2xl">🎯</span>
                      遊び方
                    </h3>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm md:text-base">
                    <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10 hover:bg-white/10 transition-colors duration-300">
                      <div className="text-xl md:text-2xl mb-2">🎲</div>
                      <div className="text-white font-medium mb-1">
                        立体空間
                      </div>
                      <div className="text-white/70 text-xs md:text-sm">
                        4×4×4の立方体で4つ連続を目指そう
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10 hover:bg-white/10 transition-colors duration-300">
                      <div className="text-xl md:text-2xl mb-2">📐</div>
                      <div className="text-white font-medium mb-1">全方向</div>
                      <div className="text-white/70 text-xs md:text-sm">
                        縦・横・奥行き・対角線すべてが有効
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 text-center border border-white/10 hover:bg-white/10 transition-colors duration-300 sm:col-span-2 lg:col-span-1">
                      <div className="text-xl md:text-2xl mb-2">🖱️</div>
                      <div className="text-white font-medium mb-1">操作</div>
                      <div className="text-white/70 text-xs md:text-sm">
                        マウスで視点を回転・ズーム可能
                      </div>
                    </div>
                  </div>

                  {/* フッター */}
                  <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/10 text-center">
                    <p className="text-white/50 text-sm md:text-base">
                      🚀 新次元の戦略ゲームを体験しよう
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* スクロールヒント */}
              <div className="text-center mt-8 md:hidden">
                <div className="inline-flex items-center text-white/50 text-sm">
                  <span>スクロールして全てのコンテンツを表示</span>
                  <div className="ml-2 animate-bounce">↓</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 装飾的なパーティクル */}
        <div className="fixed inset-0 pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full opacity-20 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
