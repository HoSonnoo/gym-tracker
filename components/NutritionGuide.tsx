import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const PRIMARY = '#7e47ff';
export const NUTRITION_GUIDE_KEY = '@vyro:nutrition_guide_seen';

const STEPS = [
  {
    emoji: '📓',
    title: 'Diario',
    description: 'Ogni giorno trovi il tuo riepilogo macro con grafico a torta. Collega un piano alimentare per vedere gli obiettivi giornalieri e quanto ti manca.',
  },
  {
    emoji: '📋',
    title: 'Piano alimentare',
    description: 'Crea un piano settimanale manualmente oppure importa direttamente il PDF del tuo nutrizionista — Claude lo legge e lo struttura automaticamente.',
  },
  {
    emoji: '🍳',
    title: 'Ricette',
    description: 'Salva le tue ricette preferite con ingredienti, procedimento e macro calcolati. Puoi anche importarle da PDF.',
  },
  {
    emoji: '⚖️',
    title: 'Corpo',
    description: 'Registra il tuo peso corporeo nel tempo e tagga ogni misurazione con la fase attuale: Bulk o Cut.',
  },
  {
    emoji: '🔍',
    title: 'Catalogo',
    description: 'Cerca milioni di alimenti tramite Open Food Facts o aggiungine di personalizzati. Tutti i macro vengono calcolati automaticamente.',
  },
];

export default function NutritionGuide({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      await AsyncStorage.setItem(NUTRITION_GUIDE_KEY, 'true');
      onDone();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem(NUTRITION_GUIDE_KEY, 'true');
    onDone();
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Alimentazione</Text>

      {/* Welcome card */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeEmoji}>🥗</Text>
        <Text style={styles.welcomeTitle}>Benvenuto in Alimentazione</Text>
        <Text style={styles.welcomeText}>
          Traccia la tua nutrizione, gestisci piani alimentari e monitora il corpo. Scopri come funziona ogni sezione.
        </Text>
      </View>

      {/* Step card attivo */}
      <View style={styles.activeCard}>
        <Text style={styles.activeEmoji}>{current.emoji}</Text>
        <Text style={styles.activeTitle}>{current.title}</Text>
        <Text style={styles.activeDescription}>{current.description}</Text>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <Pressable key={i} onPress={() => setStep(i)}>
            <View style={[styles.dot, i === step && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      {/* Step list (tutti gli step come preview) */}
      <View style={styles.stepList}>
        {STEPS.map((s, i) => (
          <Pressable key={i} onPress={() => setStep(i)} style={[styles.stepRow, i === step && styles.stepRowActive]}>
            <View style={[styles.stepBadge, i < step && styles.stepBadgeDone, i === step && styles.stepBadgeCurrent]}>
              <Text style={styles.stepBadgeText}>{i < step ? '✓' : s.emoji}</Text>
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>
              {s.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Bottoni */}
      <Pressable style={styles.nextBtn} onPress={handleNext}>
        <Text style={styles.nextBtnText}>
          {isLast ? 'Inizia →' : 'Avanti →'}
        </Text>
      </Pressable>

      {!isLast && (
        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipBtnText}>Salta la guida</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginBottom: 4 },
  welcomeCard: {
    backgroundColor: 'rgba(126,71,255,0.1)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.3)',
    alignItems: 'center',
    gap: 8,
  },
  welcomeEmoji: { fontSize: 40 },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: Colors.dark.text, textAlign: 'center' },
  welcomeText: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 20 },
  activeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: PRIMARY,
    gap: 8,
    alignItems: 'center',
  },
  activeEmoji: { fontSize: 44, marginBottom: 4 },
  activeTitle: { fontSize: 22, fontWeight: '800', color: Colors.dark.text },
  activeDescription: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.dark.border },
  dotActive: { width: 24, backgroundColor: PRIMARY },
  stepList: { gap: 8 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepRowActive: { borderColor: PRIMARY, backgroundColor: 'rgba(126,71,255,0.08)' },
  stepBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: 'rgba(34,197,94,0.15)' },
  stepBadgeCurrent: { backgroundColor: 'rgba(126,71,255,0.2)' },
  stepBadgeText: { fontSize: 16 },
  stepLabel: { fontSize: 15, fontWeight: '600', color: Colors.dark.textMuted },
  stepLabelActive: { color: Colors.dark.text, fontWeight: '700' },
  nextBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  skipBtn: { alignItems: 'center', paddingVertical: 8 },
  skipBtnText: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '600' },
});