import Image from "next/image";

const ILLUSTRATION_BY_NAME = {
  cloudflareDev: "/images/illustrations/cloudflare-dev.svg",
  codeContribution: "/images/illustrations/code-contribution.svg",
  dataProcessing: "/images/illustrations/data-processing.svg",
  dataTable: "/images/illustrations/data-table.svg",
  databaseTables: "/images/illustrations/database-tables.svg",
  localServer: "/images/illustrations/local-server.svg",
  maintenance: "/images/illustrations/maintenance.svg",
  server: "/images/illustrations/server.svg",
  serverStatus: "/images/illustrations/server-status.svg",
  shareResults: "/images/illustrations/share-results.svg",
  spreadsheet: "/images/illustrations/spreadsheet.svg",
  staticWebsite: "/images/illustrations/static-website.svg",
  fixTable: "/images/illustrations/fix-table.svg",
} as const;

export type IllustrationName = keyof typeof ILLUSTRATION_BY_NAME;

type IllustrationImageProps = {
  illustration: IllustrationName;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
};

function resolveIllustrationPath(illustration: IllustrationName): string {
  return ILLUSTRATION_BY_NAME[illustration];
}

export function IllustrationImage({
  illustration,
  alt,
  width,
  height,
  className,
  priority,
}: Readonly<IllustrationImageProps>) {
  return (
    <Image
      alt={alt}
      className={className}
      height={height}
      priority={priority}
      src={resolveIllustrationPath(illustration)}
      style={{ height: "auto" }}
      width={width}
    />
  );
}
