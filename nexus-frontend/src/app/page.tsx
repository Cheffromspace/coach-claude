import Chat from '../components/chat/Chat';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 container mx-auto px-4 py-8">
        <Chat />
      </div>
    </main>
  );
}
