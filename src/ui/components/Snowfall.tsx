import { useEffect, useState } from "react";
import { useTheme } from "@ui/hooks/useTheme";

interface Snowflake {
    id: number;
    left: number;
    animationDuration: number;
    animationDelay: number;
    size: number;
    opacity: number;
    swayAmount: number;
}

export function Snowfall() {
    const [snowflakes, setSnowflakes] = useState<Snowflake[]>([]);
    const { mode } = useTheme();

    // Determine if dark mode
    const isDark =
        mode === "dark" ||
        (mode === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);

    useEffect(() => {
        const flakes: Snowflake[] = [];
        const count = 50;

        for (let i = 0; i < count; i++) {
            flakes.push({
                id: i,
                left: Math.random() * 100,
                animationDuration: 10 + Math.random() * 15,
                animationDelay: Math.random() * -25,
                size: 2 + Math.random() * 2.5,
                opacity: 0.4 + Math.random() * 0.4,
                swayAmount: 20 + Math.random() * 30,
            });
        }

        setSnowflakes(flakes);
    }, []);

    const snowColor = isDark ? "#ffffff" : "#a8d4ff";

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            <style>{`
                @keyframes snowfall {
                    0% {
                        transform: translateY(-10px) translateX(0);
                    }
                    25% {
                        transform: translateY(25vh) translateX(var(--sway));
                    }
                    50% {
                        transform: translateY(50vh) translateX(calc(var(--sway) * -0.5));
                    }
                    75% {
                        transform: translateY(75vh) translateX(var(--sway));
                    }
                    100% {
                        transform: translateY(100vh) translateX(0);
                    }
                }
            `}</style>
            {snowflakes.map((flake) => (
                <div
                    key={flake.id}
                    className="absolute rounded-full"
                    style={{
                        left: `${flake.left}%`,
                        top: "-10px",
                        width: `${flake.size}px`,
                        height: `${flake.size}px`,
                        backgroundColor: snowColor,
                        opacity: flake.opacity,
                        // @ts-expect-error CSS custom property
                        "--sway": `${flake.swayAmount}px`,
                        animation: `snowfall ${flake.animationDuration}s ease-in-out infinite`,
                        animationDelay: `${flake.animationDelay}s`,
                    }}
                />
            ))}
        </div>
    );
}
