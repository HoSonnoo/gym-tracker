import { Colors } from '@/constants/Colors';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';
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
const PROXY_URL = `${SUPABASE_URL}/functions/v1/anthropic-proxy`;

const SYSTEM_PROMPT = `Sei Vyro Assistant, l'assistente AI integrato nell'app VYRO — un tracker di allenamento e nutrizione.

Rispondi SEMPRE in italiano, in modo chiaro, amichevole e conciso.

FUNZIONALITÀ DELL'APP che conosci:
- ALLENAMENTI: creazione template con esercizi e serie, sessioni reali da template, timer recupero con notifica, drag & drop ordine esercizi, personal record automatici
- NUTRIZIONE: diario alimentare giornaliero, catalogo alimenti con Open Food Facts, piano alimentare (importabile da PDF tramite AI), tracciamento acqua, peso corporeo con fasi Bulk/Cut, ricette manuali o da PDF
- PROGRESSI: grafici PR, volume, frequenza, peso corporeo, attività (passi/distanza/calorie da Apple Salute)
- CALENDARIO: storico sessioni e alimentazione
- ACCOUNT: registrazione email, accesso Google/Apple, modalità ospite con limiti, sync cloud Supabase, backup/export dati JSON e CSV, import dati, reset selettivo

RISPONDI a:
1. Domande su come usare l'app (es. "come creo un esercizio?", "come importo un piano PDF?")
2. Domande su fitness e allenamento (es. "quante volte allenarsi a settimana?", "cos'è il volume di allenamento?")
3. Domande su nutrizione (es. "quante proteine dovrei mangiare?", "cosa significa Bulk/Cut?")
4. Domande sui dati e funzionalità (es. "cosa si resetta con il reset selettivo?")

Se non sai qualcosa di specifico sull'app, dillo chiaramente. Sii breve: risposte di 2-4 frasi salvo quando serve più dettaglio.`;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

export default function ChatBot() {
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

      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: SYSTEM_PROMPT,
          messages: apiMessages,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.type === 'error') {
        const errMsg = data?.error?.message ?? `Errore API (${response.status})`;
        console.warn('ChatBot API error:', JSON.stringify(data));
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString() + '_e', role: 'assistant', text: `Errore: ${errMsg}` },
        ]);
        return;
      }
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
      {/* Bottone flottante animato */}
      <Animated.View style={[styles.fab, { transform: [{ scale: pulse }] }]}>
        <TouchableOpacity
          style={styles.fabInner}
          onPress={() => setOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabEmoji}>🤖</Text>
        </TouchableOpacity>
      </Animated.View>

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