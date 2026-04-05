"use client";

import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  useAccountBlobs,
  useShelbyClient,
  useUploadBlobs,
} from "@shelby-protocol/react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  Database,
  FileText,
  Gauge,
  Layers,
  Lock,
  RefreshCcw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const UPLOAD_EXPIRATION_MICROS = 7 * 24 * 60 * 60 * 1_000_000;

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  if (gb < 1024) return `${gb.toFixed(2)} GB`;
  return `${(gb / 1024).toFixed(2)} TB`;
}

function formatDate(micros: number) {
  return new Date(micros / 1000).toLocaleString();
}

function buildBlobName(prefix: string, fileName: string) {
  const trimmedPrefix = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmedPrefix ? `${trimmedPrefix}/${fileName}` : fileName;
}

export default function Home() {
  const shelbyClient = useShelbyClient();
  const {
    account,
    connected,
    connect,
    disconnect,
    wallets,
    signAndSubmitTransaction,
  } = useWallet();
  const accountAddress = account?.address?.toString() ?? "";
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const accountBlobs = useAccountBlobs({
    account: accountAddress,
    enabled: Boolean(accountAddress),
  });
  const uploadBlobs = useUploadBlobs({
    onSuccess: async () => {
      await accountBlobs.refetch();
      setFiles([]);
      setUploadMessage("Upload complete and synced with Shelby metadata.");
    },
    onError: (error) =>
      setUploadMessage(error?.message ?? "Upload failed. Try again."),
  });

  const addressLabel = useMemo(() => {
    if (!accountAddress) return "";
    return `${accountAddress.slice(0, 6)}...${accountAddress.slice(-4)}`;
  }, [accountAddress]);

  const uploadedBlobs = useMemo(() => accountBlobs.data ?? [], [accountBlobs.data]);

  const totalStoredBytes = useMemo(
    () => uploadedBlobs.reduce((sum, blob) => sum + blob.size, 0),
    [uploadedBlobs]
  );

  const metrics = [
    {
      label: "Selected Files",
      value: String(files.length).padStart(2, "0"),
      note: files.length === 0 ? "Nothing staged yet" : "Ready for Shelby upload",
      icon: Activity,
    },
    {
      label: "Wallet Blobs",
      value: String(uploadedBlobs.length).padStart(2, "0"),
      note: connected ? "Indexed for this wallet" : "Connect to inspect account",
      icon: Database,
    },
    {
      label: "Data Stored",
      value: formatBytes(totalStoredBytes),
      note: connected ? "Tracked from Shelby metadata" : "Waiting for wallet",
      icon: Lock,
    },
    {
      label: "API Access",
      value: process.env.NEXT_PUBLIC_SHELBY_API_KEY ? "Live" : "Missing",
      note: process.env.NEXT_PUBLIC_SHELBY_API_KEY
        ? "SDK client ready"
        : "Add NEXT_PUBLIC_SHELBY_API_KEY",
      icon: Gauge,
    },
  ];

  const recentUploads = useMemo(
    () =>
      [...uploadedBlobs]
        .sort((a, b) => b.creationMicros - a.creationMicros)
        .slice(0, 4),
    [uploadedBlobs]
  );

  const onFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    setFiles(Array.from(fileList));
    setUploadMessage("");
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    onFilesSelected(event.dataTransfer.files);
  };

  const handleConnect = () => {
    if (wallets.length === 0) {
      setUploadMessage("No Aptos wallets detected in this browser.");
      return;
    }

    const petraWallet = wallets.find((wallet) => wallet.name === "Petra");
    if (petraWallet) {
      connect(petraWallet.name);
      return;
    }

    if (wallets.length === 1) {
      connect(wallets[0].name);
      return;
    }

    setWalletMenuOpen((prev) => !prev);
  };

  const handleUpload = async () => {
    if (!account || !signAndSubmitTransaction) {
      setUploadMessage("Connect an Aptos wallet to upload to ShelbyNet.");
      return;
    }

    if (files.length === 0) {
      setUploadMessage("Add at least one file to upload.");
      return;
    }

    setUploadMessage("Preparing upload...");

    try {
      const blobs = await Promise.all(
        files.map(async (file) => ({
          blobName: buildBlobName(datasetName, file.name),
          blobData: new Uint8Array(await file.arrayBuffer()),
        }))
      );

      await uploadBlobs.mutateAsync({
        signer: { account, signAndSubmitTransaction },
        blobs,
        expirationMicros: Date.now() * 1000 + UPLOAD_EXPIRATION_MICROS,
      });
    } catch (error) {
      setUploadMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    }
  };

  const handleDownload = async (blobName: string) => {
    if (!accountAddress) {
      setDownloadMessage("Connect an Aptos wallet to browse or download blobs.");
      return;
    }

    setActiveDownload(blobName);
    setDownloadMessage(`Downloading ${blobName}...`);

    try {
      const blob = await shelbyClient.download({
        account: accountAddress,
        blobName,
      });
      const browserBlob = await new Response(blob.readable).blob();
      const url = URL.createObjectURL(browserBlob);
      const link = document.createElement("a");

      link.href = url;
      link.download = blob.name.split("/").pop() || blob.name;
      link.click();
      URL.revokeObjectURL(url);
      setDownloadMessage(`Downloaded ${blob.name}.`);
    } catch (error) {
      setDownloadMessage(
        error instanceof Error ? error.message : "Download failed."
      );
    } finally {
      setActiveDownload(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06090f]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#0f172a_0%,#06090f_55%,#050609_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(13,148,136,0.2),transparent_38%,transparent_70%,rgba(251,191,36,0.12))]" />

      <nav className="sticky top-0 z-20 border-b border-white/5 bg-[#06090f]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 sm:px-10 lg:px-12">
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            Aptos Data Vault
          </div>
          <div className="relative flex items-center gap-3 text-sm text-white/70">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60 md:flex">
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              ShelbyNet
            </div>
            {connected ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
                  <Wallet className="h-4 w-4" />
                  {addressLabel}
                </div>
                <button
                  onClick={() => disconnect()}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:text-white"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={handleConnect}
                  className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 shadow-[0_0_18px_rgba(52,211,153,0.35)] transition hover:bg-emerald-400/20"
                >
                  <span className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </span>
                </button>
                {walletMenuOpen && (
                  <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-[#0b0f19]/95 p-3 shadow-[0_25px_60px_rgba(15,23,42,0.65)] backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                      Choose Wallet
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {wallets.map((wallet) => (
                        <button
                          key={wallet.name}
                          onClick={() => {
                            connect(wallet.name);
                            setWalletMenuOpen(false);
                          }}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.25em] text-white/70 transition hover:text-white"
                        >
                          {wallet.name}
                        </button>
                      ))}
                      {wallets.length === 0 && (
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50">
                          No wallets detected
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-24 pt-12 sm:px-10 lg:px-12">
        <motion.section
          initial="hidden"
          animate="show"
          variants={container}
          className="grid gap-6"
        >
          <motion.div variants={item} className="flex flex-col gap-4">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.4em] text-emerald-200/80">
              <Sparkles className="h-4 w-4" />
              Secure Dataset Uploads And Retrievals
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Upload to ShelbyNet, then pull the same blobs back on demand.
            </h1>
            <p className="max-w-2xl text-base text-white/65 sm:text-lg">
              This dashboard now uses the Shelby React SDK for uploads and the
              Shelby client for wallet-scoped downloads, all from one flow.
            </p>
          </motion.div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="show"
          variants={container}
          className="grid gap-4 md:grid-cols-2"
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                variants={item}
                className="flex items-center justify-between gap-4 rounded-3xl border border-white/5 bg-white/5 p-5 shadow-[0_20px_45px_rgba(2,6,23,0.45)]"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-white/50">{metric.note}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10">
                  <Icon className="h-5 w-5 text-emerald-200" />
                </div>
              </motion.div>
            );
          })}
        </motion.section>

        <motion.section
          initial="hidden"
          animate="show"
          variants={container}
          className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
        >
          <motion.div
            variants={item}
            className="flex h-full flex-col gap-6 rounded-3xl border border-white/5 bg-white/5 p-6 shadow-[0_30px_60px_rgba(2,6,23,0.55)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                  Upload Session
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  New dataset package
                </h2>
              </div>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200">
                SDK Ready
              </span>
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed p-6 text-center transition ${
                isDragging
                  ? "border-emerald-300 bg-emerald-400/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
                <CloudUpload className="h-6 w-6 text-emerald-200" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Drag files or select from disk
                </p>
                <p className="mt-1 text-xs text-white/50">
                  Files are uploaded with `useUploadBlobs` and registered to your
                  wallet namespace.
                </p>
              </div>
              <label className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:text-white">
                Browse Files
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => onFilesSelected(event.target.files)}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Dataset Prefix
                </label>
                <input
                  value={datasetName}
                  onChange={(event) => setDatasetName(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                  placeholder="research/global-mobility"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Namespace
                </label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  <span className="truncate">
                    {connected ? accountAddress : "Wallet not connected"}
                  </span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-white/40" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Access Policy
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  <Lock className="h-4 w-4 text-emerald-200" />
                  Wallet-signed registration
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Expiration
                </label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  7 days from upload
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/50">
              {files.length === 0
                ? "No files selected yet."
                : files.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between gap-3 py-1"
                    >
                      <span className="text-white/80">
                        {buildBlobName(datasetName, file.name)}
                      </span>
                      <span>{formatBytes(file.size)}</span>
                    </div>
                  ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleUpload}
                disabled={uploadBlobs.isPending}
                className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadBlobs.isPending ? "Uploading" : "Upload to ShelbyNet"}
              </button>
              <button
                onClick={() => accountBlobs.refetch()}
                disabled={!connected || accountBlobs.isFetching}
                className="rounded-full border border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Refresh Blobs
                </span>
              </button>
              <span className="text-xs text-white/50">
                {uploadMessage ||
                  (connected
                    ? `${files.length} file${files.length === 1 ? "" : "s"} ready`
                    : "Connect wallet to upload")}
              </span>
            </div>
          </motion.div>

          <div className="flex h-full flex-col gap-6">
            <motion.div
              variants={item}
              className="rounded-3xl border border-white/5 bg-white/5 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                    On-chain Detail
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-white">
                    Shelby metadata
                  </h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10">
                  <Layers className="h-5 w-5 text-emerald-200" />
                </div>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                  <span>Wallet namespace</span>
                  <span className="truncate text-white/50">
                    {connected ? addressLabel : "Not connected"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                  <span>Indexed blobs</span>
                  <span className="text-white/50">{uploadedBlobs.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/70">
                  <span>Download path</span>
                  <span className="flex items-center gap-2 text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <code>client.download()</code>
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={item}
              className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/5 bg-white/5 p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                    My Blobs
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-white">
                    Download from Shelby
                  </h3>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400/10">
                  <CloudDownload className="h-5 w-5 text-sky-200" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/50">
                {downloadMessage ||
                  (connected
                    ? "Choose any indexed blob below to stream it back from Shelby."
                    : "Connect a wallet to load your account blobs.")}
              </div>
              <div className="flex flex-col gap-3">
                {accountBlobs.isLoading && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/60">
                    Loading Shelby metadata for this wallet...
                  </div>
                )}
                {!accountBlobs.isLoading && recentUploads.length === 0 && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/60">
                    No uploaded blobs found for this wallet yet.
                  </div>
                )}
                {recentUploads.map((blob) => (
                  <div
                    key={blob.name}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {blob.blobNameSuffix}
                      </p>
                      <p className="text-xs text-white/50">
                        {formatBytes(blob.size)} · {formatDate(blob.creationMicros)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
                        {blob.isWritten ? "Written" : "Pending"}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                        expires {formatDate(blob.expirationMicros)}
                      </p>
                      </div>
                      <button
                        onClick={() => handleDownload(blob.blobNameSuffix)}
                        disabled={activeDownload === blob.blobNameSuffix}
                        className="rounded-full border border-sky-300/40 bg-sky-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowDownToLine className="h-4 w-4" />
                          {activeDownload === blob.blobNameSuffix
                            ? "Downloading"
                            : "Download"}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          initial="hidden"
          animate="show"
          variants={container}
          className="grid gap-4 md:grid-cols-2"
        >
          <motion.div
            variants={item}
            className="flex items-center gap-4 rounded-3xl border border-white/5 bg-white/5 p-6"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/10">
              <FileText className="h-6 w-6 text-emerald-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                Coordination
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Indexed through Shelby coordination
              </p>
              <p className="text-xs text-white/50">
                Wallet blobs are fetched through the React query helpers.
              </p>
            </div>
          </motion.div>
          <motion.div
            variants={item}
            className="flex items-center gap-4 rounded-3xl border border-white/5 bg-white/5 p-6"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-300/10">
              <Database className="h-6 w-6 text-amber-200" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                Storage Tier
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Upload and download in the same app
              </p>
              <p className="text-xs text-white/50">
                The browser now streams downloads directly from the SDK client.
              </p>
            </div>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}
