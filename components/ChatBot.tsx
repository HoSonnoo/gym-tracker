import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';
const ANTHROPIC_API_KEY = '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';

const SYSTEM_PROMPT = `Sei Vyro Assistant, l'assistente AI integrato nell'app VYRO — un tracker di allenamento e nutrizione per atleti seri.

Rispondi SEMPRE in italiano, in modo chiaro, diretto e tecnicamente preciso.

FUNZIONALITÀ DELL'APP:
- ALLENAMENTI: template con esercizi e serie (tipo, peso, reps, RIR/RPE/buffer), sessioni reali, timer recupero con notifica, drag & drop, personal record automatici
- NUTRIZIONE: diario alimentare, catalogo alimenti Open Food Facts, piano alimentare importabile da PDF via AI, tracciamento acqua, peso corporeo con fasi Bulk/Cut, ricette
- PROGRESSI: grafici PR, volume, frequenza, peso, attività Apple Salute (passi, distanza, calorie)
- CALENDARIO: storico sessioni e alimentazione
- ACCOUNT: email/Google/Apple, modalità ospite con limiti, sync cloud, backup JSON/CSV, reset selettivo

TERMINOLOGIA FITNESS — definizioni precise:
- BUFFER / RIR (Reps In Reserve): serie eseguita lasciando ripetizioni in riserva, non a cedimento. Es. "buffer 2" significa che potresti fare ancora 2 reps prima del cedimento. Usato per gestire il fatigue accumulato e programmare la progressione in modo sostenibile.
- RPE (Rate of Perceived Exertion): scala 1-10 dello sforzo percepito. RPE 10 = cedimento muscolare, RPE 8 = buffer 2, RPE 7 = buffer 3.
- VOLUME: numero totale di serie per gruppo muscolare per settimana. Il volume efficace produce adattamento ipertrofico.
- PROGRESSIVE OVERLOAD: aumento progressivo dello stimolo allenante nel tempo (più peso, più reps, più serie, meno recupero).
- BULK: fase di surplus calorico per massimizzare la sintesi proteica muscolare. Surplus consigliato: 200-400 kcal/giorno.
- CUT: fase di deficit calorico per ridurre il grasso corporeo preservando la massa muscolare. Deficit consigliato: 300-500 kcal/giorno.
- TDEE: Total Daily Energy Expenditure — fabbisogno calorico totale giornaliero inclusa l'attività fisica.
- DELOAD: settimana di scarico con volume ridotto del 40-60% per favorire il recupero e supercompensazione.
- AMRAP: As Many Reps As Possible — serie eseguita fino al cedimento.
- DROP SET: dopo il cedimento, riduzione immediata del peso (20-30%) e proseguimento senza recupero.
- SUPERSET: due esercizi eseguiti in sequenza senza recupero tra loro.
- IPERTROFIA: aumento del volume delle fibre muscolari. Range ottimale: 6-20 reps, RIR 0-3.
- FORZA MASSIMALE: capacità di esprimere forza massima. Range: 1-5 reps, intensità 85-100% 1RM.
- MACRONUTRIENTI: proteine (4 kcal/g), carboidrati (4 kcal/g), grassi (9 kcal/g).
- PROTEINE: fabbisogno per atleti: 1.6-2.2g per kg di peso corporeo. Priorità assoluta in cut.
- CREATINA MONOIDRATO: integratore con le maggiori evidenze scientifiche per forza e ipertrofia. Dose: 3-5g/giorno, non serve il loading.
- 1RM: One Rep Maximum — carico massimale sollevabile per una sola ripetizione.

Fornisci risposte complete e tecnicamente accurate. Per termini tecnici dai sempre la definizione precisa con contesto pratico d'uso. Non essere vago.`;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export default function ChatBot() {
  const { isRegistered } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: 'Ciao! Sono Vyro Assistant 🤖\nChiedimi come usare l\'app o qualsiasi cosa su fitness e nutrizione!',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Animazione pulsazione bottone
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = newMessages
        .filter((m) => m.id !== '0')
        .map((m) => ({ role: m.role, content: m.text }));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      const reply = data?.content?.[0]?.text ?? 'Non ho capito, riprova.';

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + '_a', role: 'assistant', text: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + '_e', role: 'assistant', text: 'Errore di connessione. Riprova.' },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <>
      {/* Bottone flottante — solo per utenti registrati */}
      {isRegistered && (
        <Animated.View style={[styles.fab, { transform: [{ scale: pulse }] }]}>
          <TouchableOpacity
            style={styles.fabInner}
            onPress={() => setOpen(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.fabEmoji}>🤖</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Modal chat */}
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modal}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerEmoji}>🤖</Text>
              <View>
                <Text style={styles.headerTitle}>Vyro Assistant</Text>
                <Text style={styles.headerSub}>App · Fitness · Nutrizione</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>

          {/* Messaggi */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={[styles.bubbleText, item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
                  {item.text}
                </Text>
              </View>
            )}
            ListFooterComponent={
              loading ? (
                <View style={styles.typingBubble}>
                  <Text style={styles.typingText}>Vyro sta scrivendo...</Text>
                </View>
              ) : null
            }
          />

          {/* Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Scrivi un messaggio..."
              placeholderTextColor={Colors.dark.textMuted}
              multiline
              maxLength={500}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || loading}
              activeOpacity={0.85}
            >
              <Text style={styles.sendBtnText}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    zIndex: 999,
  },
  fabInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  fabEmoji: {
    fontSize: 24,
  },
  modal: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerEmoji: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  closeBtnText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  messageList: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    padding: 12,
    marginBottom: 4,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: PRIMARY,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextUser: {
    color: '#fff',
  },
  bubbleTextAssistant: {
    color: Colors.dark.text,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  typingText: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.dark.text,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
});