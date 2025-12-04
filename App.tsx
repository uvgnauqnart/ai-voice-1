
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { generateSpeech } from './services/geminiService';
import { createWavBlob } from './utils/audioUtils';
import { VOICES_BY_LANGUAGE, BANNED_WORDS, TOKEN_PER_CHAR, PRICE_PER_1K_TOKENS, SCENARIOS } from './constants';
import { Voice } from './types';

// --- UI Atom Components (defined outside main component to prevent re-renders) ---

const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
);

const Field: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-4">{children}</div>
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className={
      "w-full rounded-md border border-gray-300 bg-white p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
      (props.className ?? "")
    }
  />
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ loading, ...rest }) => (
  <button
    {...rest}
    className={
      "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-all active:scale-[.98] disabled:opacity-50 " +
      "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300 " +
      (rest.className ?? "")
    }
  >
    {loading ? (
      <>
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Generating...
      </>
    ) : rest.children}
  </button>
);

interface CardProps {
  children: React.ReactNode;
  title?: string;
  desc?: string;
}

const Card: React.FC<CardProps> = ({ children, title, desc }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm h-full flex flex-col">
    {title && (
      <div className="mb-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {desc && <p className="text-xs text-gray-500">{desc}</p>}
      </div>
    )}
    <div className="flex-grow">{children}</div>
  </div>
);

export default function App() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState('vi');
  const [voiceId, setVoiceId] = useState<string>(VOICES_BY_LANGUAGE['vi'].female[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [isSSML, setIsSSML] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const charCount = text.length;
  const estTokens = useMemo(() => charCount * TOKEN_PER_CHAR, [charCount]);
  const estCost = useMemo(() => (estTokens / 1000) * PRICE_PER_1K_TOKENS, [estTokens]);

  const violations = useMemo(() => {
    const lowerText = text.toLowerCase();
    return BANNED_WORDS.filter(word => lowerText.includes(word));
  }, [text]);

  const selectedVoice = useMemo<Voice>(() => {
    const allVoices = [
      ...VOICES_BY_LANGUAGE[language].female, 
      ...VOICES_BY_LANGUAGE[language].male
    ];
    return allVoices.find(v => v.id === voiceId)!;
  }, [voiceId, language]);

  const handleSynthesize = useCallback(async () => {
    if (!text.trim()) {
      setError("Please enter some text to synthesize.");
      return;
    }
    if (violations.length > 0) {
      setError(`Content contains banned words: ${violations.join(", ")}`);
      return;
    }

    setError(null);
    setLoading(true);
    setAudioUrl(null);

    try {
      const base64Audio = await generateSpeech({
        text,
        voiceId: selectedVoice.apiId,
        speed: speed,
        pitch: pitch,
        isSSML
      });
      const wavBlob = createWavBlob(base64Audio);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);

      setTimeout(() => {
        audioRef.current?.play().catch(console.error);
      }, 100);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred while generating speech.");
    } finally {
      setLoading(false);
    }
  }, [text, selectedVoice, speed, pitch, isSSML, violations]);
  
  const handleDownload = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `tts_${voiceId}_${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [audioUrl, voiceId]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    // Reset voice selection to the first available voice of the new language
    const newLangVoices = VOICES_BY_LANGUAGE[newLang];
    const firstVoice = newLangVoices.female[0] || newLangVoices.male[0];
    if(firstVoice) {
      setVoiceId(firstVoice.id);
    }
  };

  const { male: maleVoices, female: femaleVoices } = VOICES_BY_LANGUAGE[language];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 font-sans">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">AI Voice Studio</h1>
        <p className="mt-2 text-sm text-gray-600">Powered by Google Gemini. Generate multi-lingual speech with SSML support.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="Settings" desc="Choose a language, voice, and parameters">
          <Field>
            <Label htmlFor="lang-select">Ngôn ngữ (Language)</Label>
            <Select id="lang-select" value={language} onChange={handleLanguageChange}>
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
              <option value="zh">中文 (Chinese)</option>
              <option value="es">Español (Spanish)</option>
              <option value="fr">Français (French)</option>
              <option value="de">Deutsch (German)</option>
              <option value="it">Italiano (Italian)</option>
              <option value="pt">Português (Portuguese)</option>
              <option value="ru">Русский (Russian)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="ar">العربية (Arabic)</option>
              <option value="hi">हिन्दी (Hindi)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="id">Bahasa Indonesia</option>
              <option value="tr">Türkçe (Turkish)</option>
              <option value="nl">Nederlands (Dutch)</option>
              <option value="pl">Polski (Polish)</option>
              <option value="sv">Svenska (Swedish)</option>
              <option value="no">Norsk (Norwegian)</option>
              <option value="da">Dansk (Danish)</option>
              <option value="fi">Suomi (Finnish)</option>
              <option value="el">Ελληνικά (Greek)</option>
              <option value="cs">Čeština (Czech)</option>
              <option value="hu">Magyar (Hungarian)</option>
              <option value="ro">Română (Romanian)</option>
              <option value="th">ไทย (Thai)</option>
              <option value="he">עברית (Hebrew)</option>
              <option value="uk">Українська (Ukrainian)</option>
              <option value="ms">Bahasa Melayu (Malay)</option>
              <option value="fa">فارسی (Persian)</option>
              <option value="fil">Filipino</option>
              <option value="af">Afrikaans</option>
              <option value="bg">Български (Bulgarian)</option>
              <option value="ca">Català (Catalan)</option>
              <option value="hr">Hrvatski (Croatian)</option>
              <option value="et">Eesti (Estonian)</option>
              <option value="gl">Galego (Galician)</option>
              <option value="is">Íslenska (Icelandic)</option>
              <option value="lt">Lietuvių (Lithuanian)</option>
              <option value="lv">Latviešu (Latvian)</option>
              <option value="mk">Македонски (Macedonian)</option>
              <option value="sk">Slovenčina (Slovak)</option>
              <option value="sl">Slovenščina (Slovenian)</option>
              <option value="sr">Српски (Serbian)</option>
              <option value="sw">Kiswahili (Swahili)</option>
              <option value="ur">اردو (Urdu)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="jv">Basa Jawa (Javanese)</option>
            </Select>
          </Field>
          
          <Field>
            <Label htmlFor="voice-select">Giọng đọc (Voice)</Label>
            <Select
              id="voice-select"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
            >
              {femaleVoices.length > 0 && (
                <optgroup label="Giọng nữ">
                  {femaleVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {maleVoices.length > 0 && (
                <optgroup label="Giọng nam">
                  {maleVoices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
            {selectedVoice && (
              <p className="mt-2 text-xs text-gray-500">
                {selectedVoice.description}
              </p>
            )}
          </Field>

          <Field>
            <Label htmlFor="speed-range">Tốc độ (Speed): {speed.toFixed(2)}x</Label>
            <input id="speed-range" type="range" min={0.5} max={2} step={0.01} value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" disabled={isSSML}/>
          </Field>
          <Field>
            <Label htmlFor="pitch-range">Cao độ (Pitch): {pitch} semitones</Label>
            <input id="pitch-range" type="range" min={-20} max={20} step={0.1} value={pitch} onChange={e => setPitch(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" disabled={isSSML}/>
          </Field>
          <div className="flex items-center gap-2 mt-4">
            <input id="ssml-checkbox" type="checkbox" checked={isSSML} onChange={e => setIsSSML(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
            <label htmlFor="ssml-checkbox" className="text-sm font-medium text-gray-700">Enable SSML</label>
          </div>
           {isSSML && <p className="mt-1 text-xs text-indigo-600">Speed and Pitch controls are disabled when SSML is active.</p>}
        </Card>

        <Card title="Content" desc="Enter plain text or SSML">
          <textarea
            className="h-64 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            placeholder={isSSML ? '<speak>Hello <emphasis>world</emphasis>!</speak>' : "Enter text to synthesize into speech..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Characters: {charCount.toLocaleString()}</span>
            <span>Est. Cost: ~${estCost.toFixed(6)}</span>
          </div>
          {violations.length > 0 && (
            <p className="mt-2 text-xs text-red-600 font-medium">Warning: Banned words detected - {violations.join(", ")}</p>
          )}
        </Card>

        <Card title="Result & Controls" desc="Listen and download your audio">
          <div className="flex gap-2">
            <Button onClick={handleSynthesize} disabled={loading || !text.trim()} loading={loading}>Generate Speech</Button>
            <Button onClick={handleDownload} disabled={!audioUrl} className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300">Download WAV</Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4">
            <audio ref={audioRef} src={audioUrl ?? undefined} controls className="w-full" />
          </div>
          <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
            <p className="font-semibold mb-1">SSML Tips:</p>
            <code className="block whitespace-pre-wrap">{`<break time="500ms"/>`}</code>
            <code className="block whitespace-pre-wrap">{`<emphasis>text</emphasis>`}</code>
            <code className="block whitespace-pre-wrap">{`<prosody rate="fast" pitch="+2st">text</prosody>`}</code>
          </div>
        </Card>
      </div>

      <Card title="Kịch bản nhanh (Quick Scenarios)">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {SCENARIOS.map((p) => (
            <button
              key={p.name}
              onClick={() => setText(p.text)}
              className="rounded-lg border border-gray-200 p-3 text-left text-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="font-medium text-gray-800">{p.name}</div>
              <div className="text-gray-600 line-clamp-3">{p.text}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
