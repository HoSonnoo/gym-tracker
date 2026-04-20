import { Colors } from '@/constants/Colors';
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const PRIMARY = '#7e47ff';
export const NUTRITION_GUIDE_KEY = '@vyro:nutrition_guide_seen';

type GuidePhase = 'empty' | 'has_catalog' | 'ready';

export default function NutritionGuide({
  phase,
  onDone,
  onGoToCatalog,
  onGoToPiano,
}: {
  phase: GuidePhase;
  onDone: () => void;
  onGoToCatalog?: () => void;
  onGoToPiano?: () => void;
}) {
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
          Traccia i tuoi pasti, gestisci piani alimentari e monitora il corpo.
          Inizia aggiungendo i tuoi primi alimenti.
        </Text>
      </View>

      {/* Step 1 — Catalogo */}
      <View style={[
        styles.stepCard,
        phase !== 'empty' && styles.stepCardCompleted,
      ]}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepBadge,
            phase !== 'empty' && styles.stepBadgeDone,
          ]}>
            <Text style={styles.stepBadgeText}>
              {phase !== 'empty' ? '✓' : '1'}
            </Text>
          </View>
          <Text style={[
            styles.stepTitle,
            phase !== 'empty' && styles.stepTitleDone,
          ]}>
            Aggiungi alimenti al catalogo
          </Text>
        </View>
        {phase === 'empty' && (
          <>
            <Text style={styles.stepText}>
              Il catalogo è il tuo archivio personale di alimenti con i relativi macro.
              Puoi aggiungerne manualmente o cercarli online tramite Open Food Facts.
            </Text>
            <Pressable
              style={styles.stepButton}
              onPress={onGoToCatalog ?? onDone}
            >
              <Text style={styles.stepButtonText}>Vai al catalogo →</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Step 2 — Piano */}
      <View style={[
        styles.stepCard,
        phase === 'empty' && styles.stepCardMuted,
      ]}>
        <View style={styles.stepHeader}>
          <View style={[
            styles.stepBadge,
            phase === 'empty' && styles.stepBadgeMuted,
          ]}>
            <Text style={[
              styles.stepBadgeText,
              phase === 'empty' && styles.stepBadgeTextMuted,
            ]}>2</Text>
          </View>
          <Text style={[
            styles.stepTitle,
            phase === 'empty' && { color: Colors.dark.textMuted },
          ]}>
            Crea o importa un piano alimentare
          </Text>
        </View>
        {phase === 'has_catalog' && (
          <>
            <Text style={styles.stepText}>
              Nel tab Piano puoi costruire il tuo piano manualmente oppure caricare
              il PDF del tuo nutrizionista: Vyro lo strutturerà automaticamente.
            </Text>
            <Pressable style={styles.stepButton} onPress={onGoToPiano ?? onDone}>
              <Text style={styles.stepButtonText}>Vai al piano →</Text>
            </Pressable>
          </>
        )}
        {phase === 'empty' && (
          <Text style={styles.stepTextMuted}>
            Disponibile dopo aver aggiunto almeno un alimento al catalogo.
          </Text>
        )}
      </View>

      {/* Step 3 — Diario */}
      <View style={[styles.stepCard, styles.stepCardMuted]}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, styles.stepBadgeMuted]}>
            <Text style={[styles.stepBadgeText, styles.stepBadgeTextMuted]}>3</Text>
          </View>
          <Text style={[styles.stepTitle, { color: Colors.dark.textMuted }]}>
            Registra i pasti nel diario
          </Text>
        </View>
        <Text style={styles.stepTextMuted}>
          Nel tab Diario aggiungi gli alimenti ai tuoi pasti giornalieri e monitora calorie e macro.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  pageTitle: { fontSize: 30, fontWeight: '800', color: Colors.dark.text, marginTop: 8, marginBottom: 4 },
  welcomeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(126,71,255,0.35)',
    alignItems: 'center',
    gap: 10,
  },
  welcomeEmoji: { fontSize: 40 },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: Colors.dark.text, textAlign: 'center' },
  welcomeText: { fontSize: 15, color: Colors.dark.textMuted, textAlign: 'center', lineHeight: 22 },
  stepCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  stepCardCompleted: {
    borderColor: Colors.dark.success,
    backgroundColor: 'rgba(34,197,94,0.04)',
  },
  stepCardMuted: { opacity: 0.5 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: Colors.dark.success },
  stepBadgeMuted: {
    backgroundColor: Colors.dark.surfaceSoft,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  stepBadgeText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  stepBadgeTextMuted: { color: Colors.dark.textMuted },
  stepTitle: { fontSize: 16, fontWeight: '700', color: Colors.dark.text, flex: 1 },
  stepTitleDone: { color: Colors.dark.success },
  stepText: { fontSize: 14, color: Colors.dark.textMuted, lineHeight: 20 },
  stepTextMuted: { fontSize: 14, color: Colors.dark.textMuted, lineHeight: 20 },
  stepButton: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  stepButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});