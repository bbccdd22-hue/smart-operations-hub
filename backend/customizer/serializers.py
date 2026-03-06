from rest_framework import serializers

from .models import CustomFieldValue, DynamicFieldDefinition, EntityTemplate


class DynamicFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DynamicFieldDefinition
        fields = [
            "id",
            "field_key",
            "label_ar",
            "label_en",
            "field_type",
            "required",
            "visible",
            "order",
            "section",
            "metadata",
            "is_system",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EntityTemplateSerializer(serializers.ModelSerializer):
    field_definitions = DynamicFieldDefinitionSerializer(many=True, read_only=True)

    class Meta:
        model = EntityTemplate
        fields = [
            "id",
            "app_label",
            "model_name",
            "slug",
            "template_type",
            "name_ar",
            "name_en",
            "parent_template",
            "field_definitions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class EntityTemplateUpdateSerializer(serializers.ModelSerializer):
    """For PATCH: update template and optionally reorder/update fields."""
    field_definitions = DynamicFieldDefinitionSerializer(many=True, required=False)

    class Meta:
        model = EntityTemplate
        fields = [
            "name_ar",
            "name_en",
            "field_definitions",
        ]


class CustomFieldValueSerializer(serializers.ModelSerializer):
    field_key = serializers.CharField(source="field_definition.field_key", read_only=True)

    class Meta:
        model = CustomFieldValue
        fields = ["id", "field_definition", "field_key", "value_text", "value_number", "value_date"]
        read_only_fields = ["id", "field_definition"]
