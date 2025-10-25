import React from 'react';

interface CrisisAlertProps {
  isOpen: boolean;
  onClose: () => void;
  moodScore: number;
}

const CrisisAlert: React.FC<CrisisAlertProps> = ({ isOpen, onClose, moodScore }) => {
  if (!isOpen) return null;

  const isSevere = moodScore < -0.5;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-red-600">
              {isSevere ? '🚨 Akut Krisstöd' : '💙 Stöd och Hjälp'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4 text-sm text-gray-700">
            <p>
              Vi ser att du har haft det svårt. Du är inte ensam och det finns hjälp att få.
              Här är några resurser som kan stödja dig:
            </p>

            <div className="space-y-3">
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-semibold text-red-600">Självmordslinjen</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Öppen dygnet runt för akut stöd och samtal.
                </p>
                <a
                  href="tel:90101"
                  className="inline-block bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm font-medium"
                >
                  📞 Ring 90101
                </a>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-blue-600">Jourhavande Präst</h3>
                <p className="text-xs text-gray-600 mb-2">
                  För existentiella frågor och stöd.
                </p>
                <a
                  href="tel:112"
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  📞 Ring 112
                </a>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-green-600">Vårdguiden 1177</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Medicinsk rådgivning och vårdkontakt.
                </p>
                <a
                  href="tel:1177"
                  className="inline-block bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  📞 Ring 1177
                </a>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-purple-600">Mind Självmordslinjen</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Chatt och stöd online.
                </p>
                <a
                  href="https://www.mind.se/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 text-sm font-medium"
                >
                  🌐 Besök Mind.se
                </a>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="font-semibold text-orange-600">BRIS - Barnens hjälptelefon</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Stöd för unga vuxna och alla som behöver prata.
                </p>
                <a
                  href="tel:116111"
                  className="inline-block bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 text-sm font-medium mr-2"
                >
                  📞 Ring 116 111
                </a>
                <a
                  href="https://www.bris.se/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600 text-sm font-medium"
                >
                  🌐 BRIS.se
                </a>
              </div>

              <div className="border-l-4 border-teal-500 pl-4">
                <h3 className="font-semibold text-teal-600">SPES - Riksförbundet för SuicidPrevention</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Anhörigstöd och prevention.
                </p>
                <a
                  href="https://www.spes.se/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700 text-sm font-medium"
                >
                  🌐 SPES.se
                </a>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-indigo-600">Jourhavande Medmänniska</h3>
                <p className="text-xs text-gray-600 mb-2">
                  Samtalshjälp för existentiella frågor.
                </p>
                <a
                  href="tel:08-7020020"
                  className="inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                  📞 Ring 08-702 00 20
                </a>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
              <p className="text-xs text-yellow-800">
                <strong>Kom ihåg:</strong> Dina känslor är viktiga och giltiga.
                Att söka hjälp är ett tecken på styrka, inte svaghet.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Stäng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrisisAlert;
