package com.studiobs.spring_backend.domain.brew.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "brew_checklist_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewChecklistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "template_id", nullable = false, length = 36)
    private UUID templateId;

    @Column(nullable = false, length = 200)
    private String body;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public BrewChecklistItem(UUID templateId, String body, int sortOrder) {
        this.templateId = templateId;
        this.body = body;
        this.sortOrder = sortOrder;
    }
}
