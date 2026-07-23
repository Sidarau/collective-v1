import Image from "next/image";

type GateGalleryProps = {
  gateName: string;
  heroImage?: string | null;
  images: string[];
};

export function GateGallery({
  gateName,
  heroImage,
  images,
}: GateGalleryProps) {
  const galleryImages = images.filter(
    (image): image is string => Boolean(image) && image !== heroImage
  );

  if (galleryImages.length === 0) return null;

  return (
    <section aria-labelledby="gate-gallery-title">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 id="gate-gallery-title" className="eyebrow">
          Inside the Gate
        </h2>
        <p className="faint text-[12px]">
          {galleryImages.length} views · swipe
        </p>
      </div>
      <div
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1"
        aria-label={`${gateName} photo gallery`}
      >
        {galleryImages.map((image, index) => (
          <figure
            key={image}
            className="glass-flat relative h-64 w-[82vw] max-w-[440px] shrink-0 snap-center overflow-hidden"
          >
            <Image
              src={image}
              alt={`${gateName} — view ${index + 1} of ${galleryImages.length}`}
              fill
              sizes="(max-width: 768px) 82vw, 440px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-base/35 via-transparent to-transparent" />
            <figcaption className="chip absolute bottom-3 right-3 border-white/20 bg-base/45 text-ink/75 backdrop-blur-md">
              {String(index + 1).padStart(2, "0")} /{" "}
              {String(galleryImages.length).padStart(2, "0")}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
