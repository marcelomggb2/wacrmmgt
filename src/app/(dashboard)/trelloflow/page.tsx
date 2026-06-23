import { Metadata } from "next";

export const metadata: Metadata = {
  title: "TrelloFlow",
};

export default function TrelloFlowPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen w-full flex-col">
      <iframe
        src="/trelloflow/index.html"
        className="w-full h-full flex-1 border-0"
        title="TrelloFlow"
      />
    </div>
  );
}
