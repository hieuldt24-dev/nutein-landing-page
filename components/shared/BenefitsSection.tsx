"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { BounceChars } from "@/components/ui/BounceChars";
import benefitOne from "../../public/media/4 card task 3 t\u00e1ch/4-o\u0302-task-3_01.jpg";
import benefitTwo from "../../public/media/4 card task 3 t\u00e1ch/4-o\u0302-task-3_02.jpg";
import benefitThree from "../../public/media/4 card task 3 t\u00e1ch/4-o\u0302-task-3_03.jpg";
import benefitFour from "../../public/media/4 card task 3 t\u00e1ch/4-o\u0302-task-3_04.jpg";

const BENEFIT_CARDS = [
  { src: benefitOne, alt: "Protein th\u1ef1c v\u1eadt \u0111a ngu\u1ed3n" },
  { src: benefitTwo, alt: "Nutein kh\u00f4ng ch\u1ec9 l\u00e0 protein" },
  { src: benefitThree, alt: "Nutein \u0111\u1ec3 b\u1ed5 sung m\u1ed7i ng\u00e0y" },
  { src: benefitFour, alt: "Nutein \u0111\u1ed3ng h\u00e0nh c\u00f9ng h\u00e0nh tr\u00ecnh ph\u1ee5c h\u1ed3i" },
];

const BENEFIT_DESKTOP_QUERY = "(min-width: 1024px)";
const BENEFIT_SCROLL_RANGE: number[] = [0.44, 0.98];
const BENEFIT_REVEAL_RANGE: number[] = [0.44, 0.56, 0.98];
const BENEFIT_HEADING_RANGE: number[] = [0, 0.42];
const BENEFIT_COMPOSITE_WIDTH_RATIO = 0.74;
const BENEFIT_COMPOSITE_HEIGHT_RATIO = 0.72;
const BENEFIT_COMPOSITE_MAX_SIZE = 1088;
const BENEFIT_HEADING_TOP_RATIO = 0.06;
const BENEFIT_HEADING_TO_COMPOSITE_GAP_RATIO = 0.035;
const BENEFIT_COMPOSITE_BOTTOM_INSET_RATIO = 0.06;

type BenefitCard = (typeof BENEFIT_CARDS)[number];

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(BENEFIT_DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function useViewportSize() {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const observer = new ResizeObserver(update);

    update();
    observer.observe(document.documentElement);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return viewport;
}

function useElementHeight(elementRef: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const update = () => setHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(update);
    update();
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);

  return height;
}

function BenefitImage({ card, priority = false, className = "" }: { card: BenefitCard; priority?: boolean; className?: string }) {
  return (
    <article className={`relative aspect-square overflow-hidden ${className}`}>
      <Image
        src={card.src}
        alt={card.alt}
        fill
        priority={priority}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 40vw, 22vw"
        className="object-cover"
      />
    </article>
  );
}

function Heading({ motionStyle, elementRef }: { motionStyle?: { y: MotionValue<number> }; elementRef?: RefObject<HTMLDivElement | null> }) {
  return (
    <motion.div ref={elementRef} style={motionStyle} className="mb-10 text-center lg:mb-0">
      <p className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">
        {"Gi\u00e1 tr\u1ecb s\u1ee9c kho\u1ebb"}
      </p>
      <h2 className="mx-auto max-w-[20ch] font-black text-[clamp(42px,6.25vw,84px)] leading-[1.05] tracking-[-0.03em] text-ink">
        <BounceChars>{"L\u1ee3i \u00edch v\u01b0\u1ee3t tr\u1ed9i t\u1eeb \u0111\u1ea1m th\u1ef1c v\u1eadt s\u1ea1ch"}</BounceChars>
      </h2>
    </motion.div>
  );
}

function StaticBenefits({ hideAtDesktop }: { hideAtDesktop: boolean }) {
  return (
    <section id="kien-thuc" className={`benefits-section benefits-section--static ${hideAtDesktop ? "lg:hidden" : ""}`}>
      <div className="benefits-section__container">
        <Heading />
        <div className="mx-auto grid max-w-[44rem] grid-cols-2 overflow-hidden rounded-[var(--radius-xl)]">
          {BENEFIT_CARDS.map((card, index) => (
            <BenefitImage key={card.src.src} card={card} priority={index === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitCardGroup({
  cards,
  side,
  progress,
  viewportWidth,
  compositeSize,
}: {
  cards: [BenefitCard, BenefitCard];
  side: "left" | "right";
  progress: MotionValue<number>;
  viewportWidth: number;
  compositeSize: number;
}) {
  const x = useTransform(
    progress,
    BENEFIT_SCROLL_RANGE,
    [side === "left" ? -(viewportWidth + compositeSize / 2) : viewportWidth + compositeSize / 2, 0],
  );
  const opacity = useTransform(progress, BENEFIT_REVEAL_RANGE, [0, 1, 1]);
  const cornerClasses = side === "left"
    ? ["rounded-tl-[var(--radius-xl)]", "rounded-bl-[var(--radius-xl)]"]
    : ["rounded-tr-[var(--radius-xl)]", "rounded-br-[var(--radius-xl)]"];

  return (
    <motion.div style={{ x, opacity }} className="grid grid-rows-2">
      {cards.map((card, index) => (
        <BenefitImage key={card.src.src} card={card} priority={side === "left" && index === 0} className={cornerClasses[index]} />
      ))}
    </motion.div>
  );
}

function ScrollBenefits() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const { width: viewportWidth, height: viewportHeight } = useViewportSize();
  const headingHeight = useElementHeight(headingRef);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const headingTop = viewportHeight * BENEFIT_HEADING_TOP_RATIO;
  const compositeTop = headingTop + headingHeight + viewportHeight * BENEFIT_HEADING_TO_COMPOSITE_GAP_RATIO;
  const compositeSize = Math.min(
    viewportWidth * BENEFIT_COMPOSITE_WIDTH_RATIO,
    viewportHeight * BENEFIT_COMPOSITE_HEIGHT_RATIO,
    viewportHeight - compositeTop - viewportHeight * BENEFIT_COMPOSITE_BOTTOM_INSET_RATIO,
    BENEFIT_COMPOSITE_MAX_SIZE,
  );
  const headingFinalY = headingTop - (viewportHeight / 2 - headingHeight / 2);
  const headingY = useTransform(
    scrollYProgress,
    BENEFIT_HEADING_RANGE,
    [0, headingFinalY],
  );

  return (
    <section
      ref={sectionRef}
      id="kien-thuc"
      className="benefits-section benefits-section--scroll"
      style={{
        "--benefit-composite-size": `${compositeSize}px`,
        "--benefit-composite-top": `${compositeTop}px`,
      } as CSSProperties}
    >
      <div className="benefits-section__stage">
        <div className="benefits-section__container benefits-section__stage-content">
          <div className="benefits-section__heading-anchor">
            <Heading elementRef={headingRef} motionStyle={{ y: headingY }} />
          </div>
          <div className="benefits-section__composite">
            <BenefitCardGroup cards={[BENEFIT_CARDS[0], BENEFIT_CARDS[2]]} side="left" progress={scrollYProgress} viewportWidth={viewportWidth} compositeSize={compositeSize} />
            <BenefitCardGroup cards={[BENEFIT_CARDS[1], BENEFIT_CARDS[3]]} side="right" progress={scrollYProgress} viewportWidth={viewportWidth} compositeSize={compositeSize} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function BenefitsSection() {
  const isDesktop = useDesktopLayout();
  const reducedMotion = useReducedMotion();

  if (reducedMotion || !isDesktop) {
    return <StaticBenefits hideAtDesktop={!reducedMotion} />;
  }

  return <ScrollBenefits />;
}
