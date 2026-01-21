import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe } from "lucide-react";

const TermsOfService = () => {
  const [language, setLanguage] = useState<"en" | "de">("en");

  const content = {
    en: {
      title: "Terms of Service",
      lastUpdated: "Last Updated: January 21, 2026",
      sections: [
        {
          title: "1. Acceptance of Terms",
          content: "By accessing and using the Retail Forecasting & Inventory Management System ('the Service'), you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use the Service."
        },
        {
          title: "2. Description of Service",
          content: "The Service provides retail forecasting, inventory management, sales tracking, and purchase order generation tools designed for retail businesses. The Service uses artificial intelligence and machine learning algorithms to provide forecasting predictions based on historical data, seasonality patterns, and holiday events."
        },
        {
          title: "3. User Accounts and Security",
          content: "You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account or any other breach of security."
        },
        {
          title: "4. Data and Privacy",
          content: "Your use of the Service is also governed by our Privacy Policy. We collect and process data about your stores, products, inventory, sales, and forecasts to provide the Service. All data is stored securely and is used solely for providing and improving the Service."
        },
        {
          title: "5. Forecasting Accuracy",
          content: "While we strive to provide accurate forecasting predictions, the Service uses machine learning models that are based on historical patterns and may not predict future events with 100% accuracy. Forecasts should be used as guidance tools and not as absolute predictions. You are responsible for making final business decisions based on your own judgment."
        },
        {
          title: "6. Intellectual Property",
          content: "The Service, including all software, algorithms, designs, text, graphics, and other content, is owned by us or our licensors and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or reverse engineer any part of the Service."
        },
        {
          title: "7. Acceptable Use",
          content: "You agree not to: (a) use the Service for any illegal purposes; (b) attempt to gain unauthorized access to the Service or its related systems; (c) interfere with or disrupt the Service; (d) use the Service to transmit any harmful code or malware; (e) violate any applicable laws or regulations."
        },
        {
          title: "8. Limitation of Liability",
          content: "To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service."
        },
        {
          title: "9. Service Modifications",
          content: "We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may also modify these Terms of Service from time to time. Continued use of the Service after any such changes constitutes your acceptance of the new terms."
        },
        {
          title: "10. Termination",
          content: "We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the Service will immediately cease."
        },
        {
          title: "11. Governing Law",
          content: "These Terms shall be governed by and construed in accordance with the laws of Germany, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be subject to the exclusive jurisdiction of the courts in Germany."
        },
        {
          title: "12. Contact Information",
          content: "If you have any questions about these Terms of Service, please contact us through the application's support channels or at the contact information provided in your account dashboard."
        }
      ]
    },
    de: {
      title: "Nutzungsbedingungen",
      lastUpdated: "Letzte Aktualisierung: 21. Januar 2026",
      sections: [
        {
          title: "1. Annahme der Bedingungen",
          content: "Durch den Zugriff auf und die Nutzung des Retail Forecasting & Inventory Management Systems ('der Service') akzeptieren Sie die Bedingungen dieser Vereinbarung und verpflichten sich, diese einzuhalten. Wenn Sie mit diesen Bedingungen nicht einverstanden sind, nutzen Sie bitte den Service nicht."
        },
        {
          title: "2. Beschreibung des Services",
          content: "Der Service bietet Tools für Einzelhandelsprognosen, Bestandsverwaltung, Verkaufsverfolgung und Bestellungsgenerierung, die für Einzelhandelsunternehmen entwickelt wurden. Der Service verwendet künstliche Intelligenz und maschinelle Lernalgorithmen, um Prognosen basierend auf historischen Daten, Saisonalitätsmustern und Feiertagsereignissen bereitzustellen."
        },
        {
          title: "3. Benutzerkonten und Sicherheit",
          content: "Sie sind für die Wahrung der Vertraulichkeit Ihrer Kontodaten verantwortlich. Sie stimmen zu, die Verantwortung für alle Aktivitäten zu übernehmen, die unter Ihrem Konto stattfinden. Sie müssen uns unverzüglich über jede unbefugte Nutzung Ihres Kontos oder andere Sicherheitsverletzungen informieren."
        },
        {
          title: "4. Daten und Datenschutz",
          content: "Ihre Nutzung des Services unterliegt auch unserer Datenschutzrichtlinie. Wir sammeln und verarbeiten Daten über Ihre Geschäfte, Produkte, Bestände, Verkäufe und Prognosen, um den Service bereitzustellen. Alle Daten werden sicher gespeichert und ausschließlich zur Bereitstellung und Verbesserung des Services verwendet."
        },
        {
          title: "5. Prognosegenauigkeit",
          content: "Obwohl wir bestrebt sind, genaue Prognosen bereitzustellen, verwendet der Service maschinelle Lernmodelle, die auf historischen Mustern basieren und zukünftige Ereignisse möglicherweise nicht mit 100%iger Genauigkeit vorhersagen können. Prognosen sollten als Orientierungshilfen und nicht als absolute Vorhersagen verwendet werden. Sie sind für finale Geschäftsentscheidungen basierend auf Ihrem eigenen Urteilsvermögen verantwortlich."
        },
        {
          title: "6. Geistiges Eigentum",
          content: "Der Service, einschließlich aller Software, Algorithmen, Designs, Texte, Grafiken und anderer Inhalte, gehört uns oder unseren Lizenzgebern und ist durch Urheber-, Marken- und andere Gesetze zum Schutz des geistigen Eigentums geschützt. Sie dürfen keinen Teil des Services kopieren, modifizieren, verteilen oder zurückentwickeln."
        },
        {
          title: "7. Akzeptable Nutzung",
          content: "Sie stimmen zu: (a) den Service nicht für illegale Zwecke zu nutzen; (b) nicht zu versuchen, unbefugten Zugang zum Service oder seinen zugehörigen Systemen zu erlangen; (c) den Service nicht zu stören oder zu unterbrechen; (d) den Service nicht zu verwenden, um schädlichen Code oder Malware zu übertragen; (e) keine geltenden Gesetze oder Vorschriften zu verletzen."
        },
        {
          title: "8. Haftungsbeschränkung",
          content: "Im gesetzlich zulässigen Umfang haften wir nicht für indirekte, zufällige, besondere, Folge- oder Strafschäden oder für Gewinn- oder Umsatzverluste, unabhängig davon, ob diese direkt oder indirekt entstehen, oder für Verluste von Daten, Nutzung, Goodwill oder anderen immateriellen Verlusten, die sich aus Ihrer Nutzung des Services ergeben."
        },
        {
          title: "9. Service-Änderungen",
          content: "Wir behalten uns das Recht vor, den Service jederzeit ohne Vorankündigung zu ändern, auszusetzen oder einzustellen. Wir können diese Nutzungsbedingungen auch von Zeit zu Zeit ändern. Die fortgesetzte Nutzung des Services nach solchen Änderungen stellt Ihre Zustimmung zu den neuen Bedingungen dar."
        },
        {
          title: "10. Kündigung",
          content: "Wir können Ihr Konto und Ihren Zugang zum Service sofort, ohne vorherige Ankündigung oder Haftung, aus jedem Grund beenden oder aussetzen, einschließlich wenn Sie gegen diese Bedingungen verstoßen. Bei Kündigung endet Ihr Recht zur Nutzung des Services sofort."
        },
        {
          title: "11. Anwendbares Recht",
          content: "Diese Bedingungen unterliegen den Gesetzen Deutschlands und sind in Übereinstimmung mit diesen auszulegen, ohne Berücksichtigung von Kollisionsnormen. Alle Streitigkeiten, die sich aus diesen Bedingungen oder dem Service ergeben, unterliegen der ausschließlichen Zuständigkeit der Gerichte in Deutschland."
        },
        {
          title: "12. Kontaktinformationen",
          content: "Wenn Sie Fragen zu diesen Nutzungsbedingungen haben, kontaktieren Sie uns bitte über die Support-Kanäle der Anwendung oder über die Kontaktinformationen in Ihrem Konto-Dashboard."
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

export default TermsOfService;
