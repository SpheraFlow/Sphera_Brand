
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export interface ContentMix {
    reels: number;
    static: number;
    carousel: number;
    stories: number;
    photos: number;
}

export const EMPTY_MIX: ContentMix = { reels: 0, static: 0, carousel: 0, stories: 0, photos: 0 };
export const DEFAULT_MIX: ContentMix = { reels: 4, static: 12, carousel: 4, stories: 15, photos: 0 };

export interface CampaignWizardState {
    // Step 1: Objetivo & Período
    goal: string;
    selectedMonths: string[];

    // Step 2: Mix de Conteúdo
    mix: ContentMix;                              // Mix global (usado quando monthlyMix=null)
    monthlyMix: Record<string, ContentMix> | null; // null = usar mix global distribuído

    // Step 3: Briefing & Restrições
    briefing: string;
    restrictions: string;
    importantDates: string;
    selectedDateIds: string[];
    produtosFocoIds: string[];
    carouselSlideCount: string; // "auto" or numeric string (e.g. "5")
    monthlyBriefings: Record<string, { briefing: string; monthReferences: string }>;
}

const INITIAL_STATE: CampaignWizardState = {
    goal: '',
    selectedMonths: [],
    mix: DEFAULT_MIX,
    monthlyMix: null,
    briefing: '',
    restrictions: '',
    importantDates: '',
    selectedDateIds: [],
    produtosFocoIds: [],
    carouselSlideCount: 'auto',
    monthlyBriefings: {}
};

export function useCampaignWizard() {
    const { clientId } = useParams<{ clientId: string }>();
    const [currentStep, setCurrentStep] = useState(1);
    const [data, setData] = useState<CampaignWizardState>(INITIAL_STATE);
    const [isLoaded, setIsLoaded] = useState(false);

    // Carregar do localStorage ao iniciar
    useEffect(() => {
        if (clientId) {
            const saved = localStorage.getItem(`campaign_draft_${clientId}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Garantir compatibilidade com drafts antigos sem photos/monthlyMix
                    if (parsed.mix && parsed.mix.photos === undefined) {
                        parsed.mix.photos = 0;
                    }
                    if (parsed.monthlyMix === undefined) {
                        parsed.monthlyMix = null;
                    }
                    if (parsed.carouselSlideCount === undefined) {
                        parsed.carouselSlideCount = INITIAL_STATE.carouselSlideCount;
                    }
                    setData(parsed);
                } catch (e) {
                    console.error('Erro ao carregar draft', e);
                }
            }
            setIsLoaded(true);
        }
    }, [clientId]);

    // Salvar no localStorage sempre que mudar
    useEffect(() => {
        if (isLoaded && clientId) {
            localStorage.setItem(`campaign_draft_${clientId}`, JSON.stringify(data));
        }
    }, [data, clientId, isLoaded]);

    const updateData = (updates: Partial<CampaignWizardState>) => {
        setData(prev => ({ ...prev, ...updates }));
    };

    /** Mix global stepper (modo global) */
    const updateMix = (type: keyof ContentMix, delta: number) => {
        setData(prev => ({
            ...prev,
            mix: { ...prev.mix, [type]: Math.max(0, prev.mix[type] + delta) }
        }));
    };

    /** Atualiza o mix de um mês específico (modo por mês) */
    const updateMonthMix = (month: string, type: keyof ContentMix, delta: number) => {
        setData(prev => {
            const currentMonthlyMix = prev.monthlyMix || {};
            const currentMonthMix = currentMonthlyMix[month] || { ...prev.mix };
            return {
                ...prev,
                monthlyMix: {
                    ...currentMonthlyMix,
                    [month]: {
                        ...currentMonthMix,
                        [type]: Math.max(0, currentMonthMix[type] + delta)
                    }
                }
            };
        });
    };

    /** Ativa modo por-mês: pré-popula cada mês com o mix global atual */
    const enableMonthlyMode = () => {
        setData(prev => {
            const monthly: Record<string, ContentMix> = {};
            prev.selectedMonths.forEach(m => {
                monthly[m] = { ...prev.mix };
            });
            return { ...prev, monthlyMix: monthly };
        });
    };

    /** Desativa modo por-mês: volta ao mix global */
    const disableMonthlyMode = () => {
        setData(prev => ({ ...prev, monthlyMix: null }));
    };

    /** Atualiza o briefing de um mês específico */
    const updateMonthlyBriefing = (month: string, field: 'briefing' | 'monthReferences', value: string) => {
        setData(prev => ({
            ...prev,
            monthlyBriefings: {
                ...prev.monthlyBriefings,
                [month]: { ...(prev.monthlyBriefings[month] || { briefing: '', monthReferences: '' }), [field]: value }
            }
        }));
    };

    /** Retorna o mix efetivo para um mês (respeitando modo global ou por mês) */
    const getMixForMonth = (month: string): ContentMix => {
        if (data.monthlyMix && data.monthlyMix[month]) {
            return data.monthlyMix[month];
        }
        return data.mix;
    };

    const nextStep = () => setCurrentStep(p => Math.min(3, p + 1));
    const prevStep = () => setCurrentStep(p => Math.max(1, p - 1));

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                if (data.monthlyMix !== null) {
                    return data.selectedMonths.length > 0 && data.selectedMonths.some(m =>
                        data.monthlyMix?.[m] && Object.values(data.monthlyMix[m]).some(v => v > 0)
                    );
                }
                return data.selectedMonths.length > 0 && Object.values(data.mix).some(v => v > 0);
            case 2:
                return !!data.briefing && data.briefing.length > 10;
            default:
                return true;
        }
    };

    const clearDraft = () => {
        if (clientId) {
            localStorage.removeItem(`campaign_draft_${clientId}`);
            setData(INITIAL_STATE);
            setCurrentStep(1);
        }
    };

    return {
        currentStep,
        data,
        updateData,
        updateMix,
        updateMonthMix,
        enableMonthlyMode,
        disableMonthlyMode,
        getMixForMonth,
        updateMonthlyBriefing,
        nextStep,
        prevStep,
        validateStep,
        clearDraft,
        isLoaded
    };
}
