import { createElement, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TargetAudienceSection from "./TargetAudienceSection";

vi.mock("next/image", () => ({
  default: ({ fill, ...props }: ComponentProps<"img"> & { fill?: boolean }) => {
    void fill;
    return createElement("img", props);
  },
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "IntersectionObserver", {
  writable: true,
  value: IntersectionObserverMock,
});

const audienceCards = [
  {
    filename: "ng sau phẫu thuật.png",
    alt: "Người sau phẫu thuật",
  },
  {
    filename: "ng lớn tuổi.png",
    alt: "Người lớn tuổi",
  },
  {
    filename: "ng sau ốm.png",
    alt: "Người sau ốm",
  },
  {
    filename: "ng bổ sung protein.png",
    alt: "Người cần bổ sung thêm protein",
  },
];

describe("TargetAudienceSection", () => {
  it("renders the 3:4 Task 5 audience artwork in source-of-truth order", () => {
    const { container } = render(<TargetAudienceSection />);
    const images = screen.getAllByRole("img");

    expect(images).toHaveLength(4);
    expect(images.map((image) => decodeURIComponent(image.getAttribute("src") ?? ""))).toEqual(
      audienceCards.map((card) => expect.stringContaining(card.filename)),
    );
    expect(images.map((image) => image.getAttribute("alt"))).toEqual(
      audienceCards.map((card) => card.alt),
    );
    expect(container.querySelector("#target-audience")).toBeInTheDocument();
    expect(container.querySelector(".audience-section__grid")).toBeInTheDocument();
    expect(container.querySelectorAll(".audience-section__card")).toHaveLength(4);
    expect(container.textContent).not.toContain("Dân Văn Phòng Bận Rộn");
    expect(container.textContent).not.toContain("Người Tập Gym, Yoga & Pilates");
  });
});
