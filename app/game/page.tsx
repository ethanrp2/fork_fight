import RequireAuth from '@/components/RequireAuth';

export default function GamePage() {
  return (
    <RequireAuth>
      <div className="p-4">
        <h1 className="text-2xl font-bold">Survey</h1>
        <p className="text-gray-600 mt-2">Coming soon...</p>
      </div>
    </RequireAuth>
  );
}
