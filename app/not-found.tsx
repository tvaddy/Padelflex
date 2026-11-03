import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h2 className="text-3xl font-bold mb-4">Fant ikke siden</h2>
      <p className="text-gray-400 mb-8">Beklager, men siden du leter etter finnes ikke.</p>
      <Link
        href="/"
        className="bg-[#BFFF00] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#a8e600] transition"
      >
        Gå til forsiden
      </Link>
    </div>
  );
}
