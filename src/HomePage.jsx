// HomePage.jsx
import React from "react";

const HomePage = () => {
  return (
    <div className="bg-black min-h-screen text-white">
      {/* Контейнер всей страницы */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-[3fr_1fr] gap-6">
        
        {/* Левая колонка (посты) */}
        <div className="space-y-6">
          {/* Пост */}
          <div className="bg-neutral-900 rounded-2xl shadow-md overflow-hidden">
            <img
              src="https://picsum.photos/900/400?random=1"
              alt="post"
              className="w-full h-64 object-cover"
            />
            <div className="p-4">
              <h2 className="text-lg font-bold text-yellow-400">
                Физика: Ньютон заңдары
              </h2>
              <p className="text-sm text-gray-300 mt-2">
                Бұл постта Ньютон заңдарының маңызы түсіндіріледі.
              </p>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-400">Автор: Admin</span>
                <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-lg text-sm">
                  Ашыңыз →
                </button>
              </div>
            </div>
          </div>

          {/* Второй пост */}
          <div className="bg-neutral-900 rounded-2xl shadow-md overflow-hidden">
            <img
              src="https://picsum.photos/900/400?random=2"
              alt="post"
              className="w-full h-64 object-cover"
            />
            <div className="p-4">
              <h2 className="text-lg font-bold text-yellow-400">
                Алгебра: квадрат теңдеулер
              </h2>
              <p className="text-sm text-gray-300 mt-2">
                Қадамдар арқылы квадрат теңдеулерді шешу әдістері көрсетілген.
              </p>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-gray-400">Автор: Teacher</span>
                <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-lg text-sm">
                  Ашыңыз →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Правая колонка (сайдбар) */}
        <div className="space-y-6">
          {/* Категории */}
          <div className="bg-neutral-900 rounded-2xl p-4 shadow-md">
            <h3 className="font-bold mb-3 text-yellow-400">Категориялар</h3>
            <ul className="space-y-2">
              <li className="bg-neutral-800 px-3 py-2 rounded-lg cursor-pointer hover:bg-yellow-500 hover:text-black">
                Барлығы
              </li>
              <li className="bg-neutral-800 px-3 py-2 rounded-lg cursor-pointer hover:bg-yellow-500 hover:text-black">
                Математика (1)
              </li>
              <li className="bg-neutral-800 px-3 py-2 rounded-lg cursor-pointer hover:bg-yellow-500 hover:text-black">
                Физика (1)
              </li>
            </ul>
          </div>

          {/* Топ қолданушылар */}
          <div className="bg-neutral-900 rounded-2xl p-4 shadow-md">
            <h3 className="font-bold mb-3 text-yellow-400">Топ қолданушылар</h3>
            <ul className="space-y-2">
              <li className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                <span>Teacher</span>
                <button className="text-xs bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded-lg">
                  Профиль
                </button>
              </li>
              <li className="flex justify-between items-center bg-neutral-800 px-3 py-2 rounded-lg">
                <span>Admin</span>
                <button className="text-xs bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded-lg">
                  Профиль
                </button>
              </li>
            </ul>
          </div>

          {/* Популярные посты */}
          <div className="bg-neutral-900 rounded-2xl p-4 shadow-md">
            <h3 className="font-bold mb-3 text-yellow-400">Популярные посты</h3>
            <ul className="space-y-2 text-sm">
              <li className="hover:underline cursor-pointer">
                Алгебра: квадрат теңдеулер
              </li>
              <li className="hover:underline cursor-pointer">
                Физика: Ньютон заңдары
              </li>
            </ul>
          </div>

          {/* Оповещения */}
          <div className="bg-neutral-900 rounded-2xl p-4 shadow-md">
            <h3 className="font-bold mb-2 text-yellow-400">Хабарламалар</h3>
            <p className="text-sm text-gray-300">
              Жүйеде техникалық жұмыстар: 25 қыркүйек.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
