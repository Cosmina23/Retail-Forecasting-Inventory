import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe } from "lucide-react";

const PrivacyPolicy = () => {
  const [language, setLanguage] = useState<"en" | "de">("en");

  const content = {
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last Updated: January 21, 2026",
      sections: [
        {
          title: "1. Introduction",
          content: "This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Retail Forecasting & Inventory Management System ('the Service'). We are committed to protecting your privacy and ensuring the security of your data."
        },
        {
          title: "2. Information We Collect",
          content: "We collect information that you provide directly to us, including: account information (name, email, company name, password), store information (store names, locations), product data (product names, categories, prices, SKUs), inventory data (stock levels, warehouse information), sales data (transaction records, sales history), and forecast preferences. We also automatically collect certain information about your device and how you interact with the Service, including IP addresses, browser type, access times, and pages viewed."
        },
        {
          title: "3. How We Use Your Information",
          content: "We use the information we collect to: provide and maintain the Service, generate forecasts and recommendations using AI and machine learning algorithms, manage your account and provide customer support, send you technical notices and updates, monitor and analyze trends and usage, detect and prevent fraud and security issues, improve and optimize the Service, comply with legal obligations."
        },
        {
          title: "4. Data Storage and Security",
          content: "Your data is stored securely in MongoDB databases with encryption. We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security."
        },
        {
          title: "5. AI and Machine Learning",
          content: "We use artificial intelligence and machine learning algorithms to analyze your sales history, inventory levels, seasonal patterns, and holiday events to generate forecasts. These algorithms process your data locally within the Service and do not share your business data with third-party AI services. The models learn from aggregate patterns across users to improve accuracy while maintaining data privacy."
        },
        {
          title: "6. Data Sharing and Disclosure",
          content: "We do not sell your personal information to third parties. We may share your information only in the following circumstances: with your consent, to comply with legal obligations, to protect our rights and prevent fraud, with service providers who assist in operating the Service (under strict confidentiality agreements), in connection with a merger, acquisition, or sale of assets (with notice to you)."
        },
        {
          title: "7. Your Data Rights",
          content: "Under GDPR and other data protection laws, you have the right to: access your personal data, correct inaccurate data, request deletion of your data, object to or restrict processing, data portability, withdraw consent at any time. To exercise these rights, please contact us through the application's support channels."
        },
        {
          title: "8. Data Retention",
          content: "We retain your information for as long as your account is active or as needed to provide the Service. We will retain and use your information as necessary to comply with legal obligations, resolve disputes, and enforce our agreements. You may request deletion of your account and associated data at any time."
        },
        {
          title: "9. Cookies and Tracking",
          content: "We use cookies and similar tracking technologies to track activity on the Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of the Service."
        },
        {
          title: "10. International Data Transfers",
          content: "Your information may be transferred to and maintained on servers located outside of your country or jurisdiction where data protection laws may differ. By using the Service, you consent to the transfer of your information to Germany and other countries where we operate."
        },
        {
          title: "11. Children's Privacy",
          content: "The Service is not intended for use by children under the age of 16. We do not knowingly collect personal information from children under 16. If you become aware that a child has provided us with personal information, please contact us."
        },
        {
          title: "12. Changes to This Privacy Policy",
          content: "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the 'Last Updated' date. You are advised to review this Privacy Policy periodically for any changes."
        },
        {
          title: "13. Contact Us",
          content: "If you have any questions about this Privacy Policy or our data practices, please contact us through the application's support channels or at the contact information provided in your account dashboard."
        }
      ]
    },
    de: {
      title: "Datenschutzrichtlinie",
      lastUpdated: "Letzte Aktualisierung: 21. Januar 2026",
      sections: [
        {
          title: "1. Einführung",
          content: "Diese Datenschutzrichtlinie erläutert, wie wir Ihre Informationen sammeln, verwenden, offenlegen und schützen, wenn Sie unser Retail Forecasting & Inventory Management System ('der Service') nutzen. Wir verpflichten uns, Ihre Privatsphäre zu schützen und die Sicherheit Ihrer Daten zu gewährleisten."
        },
        {
          title: "2. Informationen, die wir sammeln",
          content: "Wir sammeln Informationen, die Sie uns direkt zur Verfügung stellen, einschließlich: Kontoinformationen (Name, E-Mail, Firmenname, Passwort), Geschäftsinformationen (Geschäftsnamen, Standorte), Produktdaten (Produktnamen, Kategorien, Preise, SKUs), Bestandsdaten (Lagerbestände, Lagerinformationen), Verkaufsdaten (Transaktionsaufzeichnungen, Verkaufshistorie) und Prognoseeinstellungen. Wir sammeln auch automatisch bestimmte Informationen über Ihr Gerät und wie Sie mit dem Service interagieren, einschließlich IP-Adressen, Browser-Typ, Zugriffszeiten und angesehene Seiten."
        },
        {
          title: "3. Wie wir Ihre Informationen verwenden",
          content: "Wir verwenden die von uns gesammelten Informationen, um: den Service bereitzustellen und zu warten, Prognosen und Empfehlungen mithilfe von KI und maschinellen Lernalgorithmen zu generieren, Ihr Konto zu verwalten und Kundensupport zu bieten, Ihnen technische Hinweise und Updates zu senden, Trends und Nutzung zu überwachen und zu analysieren, Betrug und Sicherheitsprobleme zu erkennen und zu verhindern, den Service zu verbessern und zu optimieren, gesetzlichen Verpflichtungen nachzukommen."
        },
        {
          title: "4. Datenspeicherung und Sicherheit",
          content: "Ihre Daten werden sicher in MongoDB-Datenbanken mit Verschlüsselung gespeichert. Wir implementieren angemessene technische und organisatorische Maßnahmen, um Ihre Informationen vor unbefugtem Zugriff, Änderung, Offenlegung oder Zerstörung zu schützen. Allerdings ist keine Übertragungsmethode über das Internet oder elektronische Speicherung zu 100% sicher, und wir können keine absolute Sicherheit garantieren."
        },
        {
          title: "5. KI und maschinelles Lernen",
          content: "Wir verwenden künstliche Intelligenz und maschinelle Lernalgorithmen, um Ihre Verkaufshistorie, Lagerbestände, saisonale Muster und Feiertagsereignisse zu analysieren, um Prognosen zu generieren. Diese Algorithmen verarbeiten Ihre Daten lokal innerhalb des Services und teilen Ihre Geschäftsdaten nicht mit Drittanbieter-KI-Diensten. Die Modelle lernen aus aggregierten Mustern über alle Benutzer hinweg, um die Genauigkeit zu verbessern und gleichzeitig den Datenschutz zu wahren."
        },
        {
          title: "6. Datenweitergabe und Offenlegung",
          content: "Wir verkaufen Ihre persönlichen Informationen nicht an Dritte. Wir können Ihre Informationen nur in den folgenden Fällen teilen: mit Ihrer Zustimmung, zur Erfüllung gesetzlicher Verpflichtungen, zum Schutz unserer Rechte und zur Verhinderung von Betrug, mit Dienstleistern, die beim Betrieb des Services helfen (unter strengen Vertraulichkeitsvereinbarungen), im Zusammenhang mit einer Fusion, Übernahme oder einem Verkauf von Vermögenswerten (mit Benachrichtigung an Sie)."
        },
        {
          title: "7. Ihre Datenrechte",
          content: "Gemäß DSGVO und anderen Datenschutzgesetzen haben Sie das Recht: auf Zugang zu Ihren personenbezogenen Daten, auf Berichtigung unrichtiger Daten, auf Löschung Ihrer Daten, auf Widerspruch gegen oder Einschränkung der Verarbeitung, auf Datenübertragbarkeit, auf jederzeitigen Widerruf der Einwilligung. Um diese Rechte auszuüben, kontaktieren Sie uns bitte über die Support-Kanäle der Anwendung."
        },
        {
          title: "8. Datenspeicherung",
          content: "Wir speichern Ihre Informationen so lange, wie Ihr Konto aktiv ist oder wie es zur Bereitstellung des Services erforderlich ist. Wir werden Ihre Informationen speichern und verwenden, soweit dies zur Erfüllung gesetzlicher Verpflichtungen, zur Beilegung von Streitigkeiten und zur Durchsetzung unserer Vereinbarungen erforderlich ist. Sie können jederzeit die Löschung Ihres Kontos und der zugehörigen Daten beantragen."
        },
        {
          title: "9. Cookies und Tracking",
          content: "Wir verwenden Cookies und ähnliche Tracking-Technologien, um Aktivitäten im Service zu verfolgen und bestimmte Informationen zu speichern. Sie können Ihren Browser anweisen, alle Cookies abzulehnen oder anzuzeigen, wenn ein Cookie gesendet wird. Wenn Sie jedoch keine Cookies akzeptieren, können Sie möglicherweise einige Teile des Services nicht nutzen."
        },
        {
          title: "10. Internationale Datenübertragungen",
          content: "Ihre Informationen können auf Server außerhalb Ihres Landes oder Ihrer Gerichtsbarkeit übertragen und dort gespeichert werden, wo die Datenschutzgesetze unterschiedlich sein können. Durch die Nutzung des Services stimmen Sie der Übertragung Ihrer Informationen nach Deutschland und in andere Länder zu, in denen wir tätig sind."
        },
        {
          title: "11. Datenschutz für Kinder",
          content: "Der Service ist nicht für die Nutzung durch Kinder unter 16 Jahren bestimmt. Wir sammeln wissentlich keine persönlichen Informationen von Kindern unter 16 Jahren. Wenn Sie feststellen, dass ein Kind uns persönliche Informationen zur Verfügung gestellt hat, kontaktieren Sie uns bitte."
        },
        {
          title: "12. Änderungen dieser Datenschutzrichtlinie",
          content: "Wir können unsere Datenschutzrichtlinie von Zeit zu Zeit aktualisieren. Wir werden Sie über alle Änderungen informieren, indem wir die neue Datenschutzrichtlinie auf dieser Seite veröffentlichen und das Datum 'Letzte Aktualisierung' aktualisieren. Es wird empfohlen, diese Datenschutzrichtlinie regelmäßig auf Änderungen zu überprüfen."
        },
        {
          title: "13. Kontaktieren Sie uns",
          content: "Wenn Sie Fragen zu dieser Datenschutzrichtlinie oder unseren Datenpraktiken haben, kontaktieren Sie uns bitte über die Support-Kanäle der Anwendung oder über die Kontaktinformationen in Ihrem Konto-Dashboard."
        }
      ]
    }
  };

  const currentContent = content[language];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/register">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign Up
            </Button>
          </Link>
          
          <div className="flex gap-2">
            <Button
              variant={language === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("en")}
            >
              <Globe className="w-4 h-4 mr-2" />
              English
            </Button>
            <Button
              variant={language === "de" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("de")}
            >
              <Globe className="w-4 h-4 mr-2" />
              Deutsch
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{currentContent.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{currentContent.lastUpdated}</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <div className="space-y-6">
              {currentContent.sections.map((section, index) => (
                <div key={index}>
                  <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
