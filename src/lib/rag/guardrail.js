import OpenAI from "openai";
import { PII_PATTERNS, INJECTION_KEYWORDS } from "./blackList.js";

export class GuardrailService {
    constructor(apiKey, baseURL) {
        if (apiKey) {
            this.openai = new OpenAI({ apiKey, baseURL });
        }
    }

    async validateInput(input) {
        if (this.hasPromptInjection(input)) {
            return {
                passed: false,
                reason: "Yêu cầu vi phạm chính sách an toàn hệ thống (Prompt Injection).",
            };
        }

        if (this.openai) {
            const isFlagged = await this.checkModeration(input);
            if (isFlagged) {
                return {
                    passed: false,
                    reason: "Nội dung vi phạm tiêu chuẩn cộng đồng (Toxicity/Harmful content).",
                };
            }
        }

        return {
            passed: true,
            sanitizedInput: input,
        };
    }

    sanitizePII(text, redactTypes = ["email", "phone", "creditCard", "idCard"]) {
        let result = text;
        if (redactTypes.includes("email") && PII_PATTERNS.email) {
            result = result.replace(PII_PATTERNS.email, "[EMAIL_REDACTED]");
        }
        if (redactTypes.includes("phone") && PII_PATTERNS.phone) {
            result = result.replace(PII_PATTERNS.phone, "[PHONE_REDACTED]");
        }
        if (redactTypes.includes("idCard") && PII_PATTERNS.idCard) {
            result = result.replace(PII_PATTERNS.idCard, "[ID_CARD_REDACTED]");
        }
        if (redactTypes.includes("creditCard") && PII_PATTERNS.creditCard) {
            result = result.replace(PII_PATTERNS.creditCard, "[CARD_REDACTED]");
        }
        return result;
    }

    hasPromptInjection(input) {
        const lowerInput = input.toLowerCase();
        return INJECTION_KEYWORDS.some((keyword) => lowerInput.includes(keyword));
    }

    async checkModeration(input) {
        try {
            if (!this.openai) return false;
            const response = await this.openai.moderations.create({ input });
            return response.results[0]?.flagged ?? false;
        } catch (error) {
            return false;
        }
    }
}