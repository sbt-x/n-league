import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="h-full relative flex items-center justify-center bg-white">
      {/* Large background 404 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[10rem] md:text-[18rem] lg:text-[24rem] font-extrabold leading-none text-red-100">
          404
        </span>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 w-full max-w-3xl px-6 py-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-gray-900 mb-3">
            Not Found
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl text-gray-600 mb-6">
            URL が間違っているか、ページが移動または削除された可能性があります。
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              ホームへ戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
